import { db } from "./db";
import { TRIAL_DAYS } from "./constants";

export class EnrollmentError extends Error {}

/**
 * Core academy enrollment transaction.
 *
 * Enforces the business rules server-side:
 *  - Personal Branding + Social Media are auto-included and auto-approved.
 *  - Exactly one elective is selected; it starts as PENDING.
 *  - A free first month (trial) starts at enrollment; billing starts after it.
 *  - Subscription items are stored per course (never a hardcoded total).
 */
export async function submitApplication(input: {
  userId: string;
  currentOccupation: string;
  experienceLevel: string;
  about: string;
  motivation: string;
  goals: string;
  challenge: string;
  selectedElectiveId: string;
}) {
  const elective = await db.course.findUnique({
    where: { id: input.selectedElectiveId },
  });
  if (!elective || !elective.isActive || elective.type !== "ELECTIVE") {
    throw new EnrollmentError("Please select a valid elective course.");
  }

  const existing = await db.application.findFirst({
    where: { userId: input.userId, status: "PENDING" },
  });
  if (existing) {
    throw new EnrollmentError("You already have an application under review.");
  }

  const compulsoryCourses = await db.course.findMany({
    where: { type: "COMPULSORY", isActive: true },
  });
  if (compulsoryCourses.length === 0) {
    throw new EnrollmentError("Academy courses are not configured yet.");
  }

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  return db.$transaction(async (tx) => {
    const application = await tx.application.create({
      data: {
        userId: input.userId,
        currentOccupation: input.currentOccupation,
        experienceLevel: input.experienceLevel,
        about: input.about,
        motivation: input.motivation,
        goals: input.goals,
        challenge: input.challenge,
        selectedElectiveId: elective.id,
        status: "PENDING",
        submittedAt: now,
      },
    });

    // Compulsory courses: automatically approved.
    for (const course of compulsoryCourses) {
      await tx.enrollment.upsert({
        where: { userId_courseId: { userId: input.userId, courseId: course.id } },
        update: {},
        create: {
          userId: input.userId,
          courseId: course.id,
          status: "ACCEPTED",
          enrollmentType: "COMPULSORY",
          approvedAt: now,
          startedAt: now,
        },
      });
    }

    // Selected elective: pending admin approval.
    await tx.enrollment.upsert({
      where: { userId_courseId: { userId: input.userId, courseId: elective.id } },
      update: { status: "PENDING", enrollmentType: "ELECTIVE" },
      create: {
        userId: input.userId,
        courseId: elective.id,
        status: "PENDING",
        enrollmentType: "ELECTIVE",
      },
    });

    // Free first month + per-course subscription items.
    const programCourses = [...compulsoryCourses, elective];
    await tx.subscription.upsert({
      where: { userId: input.userId },
      update: {},
      create: {
        userId: input.userId,
        status: "TRIAL",
        trialStartedAt: now,
        trialEndsAt,
        billingStartedAt: trialEndsAt,
        billingCycle: "MONTHLY",
        currency: "NGN",
        items: {
          create: programCourses.map((course) => ({
            courseId: course.id,
            price: course.price,
            currency: course.currency,
          })),
        },
      },
    });

    await tx.notification.create({
      data: {
        userId: input.userId,
        type: "ENROLLMENT_ACCEPTED",
        title: "Welcome to UCA Sandbox",
        body: `Your compulsory courses are ready. Your elective (${elective.name}) is awaiting review.`,
      },
    });

    return application;
  });
}

/** Admin decision on a pending elective. */
export async function reviewElective(input: {
  applicationId: string;
  reviewerId: string;
  decision: "APPROVED" | "REJECTED";
}) {
  const application = await db.application.findUnique({
    where: { id: input.applicationId },
    include: { selectedElective: true },
  });
  if (!application) throw new EnrollmentError("Application not found.");
  if (application.status !== "PENDING") {
    throw new EnrollmentError("This application has already been reviewed.");
  }

  const now = new Date();
  return db.$transaction(async (tx) => {
    const updated = await tx.application.update({
      where: { id: application.id },
      data: {
        status: input.decision,
        reviewedAt: now,
        reviewedById: input.reviewerId,
      },
    });

    await tx.enrollment.update({
      where: {
        userId_courseId: {
          userId: application.userId,
          courseId: application.selectedElectiveId,
        },
      },
      data:
        input.decision === "APPROVED"
          ? { status: "ACCEPTED", approvedAt: now, approvedById: input.reviewerId, startedAt: now }
          : { status: "REJECTED", approvedById: input.reviewerId },
    });

    await tx.notification.create({
      data: {
        userId: application.userId,
        type: input.decision === "APPROVED" ? "ENROLLMENT_ACCEPTED" : "ENROLLMENT_REJECTED",
        title:
          input.decision === "APPROVED"
            ? `${application.selectedElective.name} approved`
            : `${application.selectedElective.name} not approved`,
        body:
          input.decision === "APPROVED"
            ? "Your elective is now available in your academy program."
            : "Your elective application was not approved. You may apply for a different elective.",
      },
    });

    return updated;
  });
}

/** Monthly total derived from subscription items — never hardcoded. */
export function subscriptionMonthlyTotal(items: { price: number }[]) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
