/**
 * One-off: move a single student's elective to Graphics Design.
 *
 * Pathway is derived from the accepted ELECTIVE enrollment, so a pathway change
 * means moving the enrollment itself — not just a label. Three records have to
 * agree, or the student ends up half-moved:
 *
 *   1. Enrollment (ELECTIVE) — courseId + pathway. This is what getStudentPathway
 *      reads, and what unlocks the course's modules and pathway community.
 *   2. Application — selectedElectiveId. Otherwise the application still names
 *      Communication / Influence while the enrollment says Graphics Design.
 *   3. SubscriptionItem — courseId. Subscriptions bill per course; leaving the
 *      old item would charge for a course the student is no longer in.
 *
 * The enrollment row is repointed rather than deleted and re-created, so the
 * original approval (approvedAt / approvedById / startedAt) survives. The
 * previous values are written to ActivityLog first, so the change is traceable
 * and reversible. No rows are deleted.
 *
 * Dry run by default.
 *   npx tsx scripts/set-student-pathway.ts
 *   npx tsx scripts/set-student-pathway.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const EMAIL = "christophermaduabuchi8@gmail.com";
const TARGET_SLUG = "graphics-design";
const TARGET_PATHWAY = "GRAPHIC_DESIGN";

const APPLY = process.argv.slice(2).includes("--apply");

async function main() {
  const user = await db.user.findFirst({
    where: { email: { equals: EMAIL, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (!user) throw new Error(`No user with email ${EMAIL}`);

  const target = await db.course.findUnique({
    where: { slug: TARGET_SLUG },
    select: { id: true, name: true, price: true, currency: true },
  });
  if (!target) throw new Error(`No course with slug ${TARGET_SLUG}`);

  const enrollment = await db.enrollment.findFirst({
    where: { userId: user.id, enrollmentType: "ELECTIVE" },
    include: { course: { select: { id: true, name: true, slug: true } } },
  });
  if (!enrollment) throw new Error("No elective enrollment found");

  const application = await db.application.findFirst({
    where: { userId: user.id },
    orderBy: { submittedAt: "desc" },
    include: { selectedElective: { select: { id: true, name: true } } },
  });

  const subItem = await db.subscriptionItem.findFirst({
    where: { subscription: { userId: user.id }, courseId: enrollment.courseId },
    select: { id: true, price: true, currency: true, courseId: true },
  });

  // Guard: repointing onto a course the student already has would violate the
  // (userId, courseId) unique index.
  const clash = await db.enrollment.findFirst({
    where: { userId: user.id, courseId: target.id },
    select: { id: true },
  });
  if (clash) throw new Error("Student already has an enrollment in the target course");

  console.log("Student      :", user.email, `(${user.id})`);
  console.log("Elective     :", enrollment.course.name, "->", target.name);
  console.log("Enrollment   :", enrollment.id, `| status ${enrollment.status} | pathway ${enrollment.pathway}`);
  console.log("Application  :", application?.selectedElective?.name ?? "(none)", "->", target.name);
  console.log("Sub item     :", subItem ? `${subItem.price} ${subItem.currency}` : "(none)", "-> keep same price, new course");
  console.log();

  if (!APPLY) {
    console.log("Dry run — nothing changed. Re-run with --apply.");
    return;
  }

  await db.$transaction(async (tx) => {
    // Record what it was, before it changes.
    await tx.activityLog.create({
      data: {
        userId: user.id,
        action: "PATHWAY_CHANGED",
        metadata: JSON.stringify({
          from: {
            course: enrollment.course.slug,
            courseId: enrollment.courseId,
            pathway: enrollment.pathway,
            enrollmentId: enrollment.id,
          },
          to: { course: TARGET_SLUG, courseId: target.id, pathway: TARGET_PATHWAY },
          reason: "One-off admin request",
        }),
      },
    });

    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: { courseId: target.id, pathway: TARGET_PATHWAY },
    });

    if (application) {
      await tx.application.update({
        where: { id: application.id },
        data: { selectedElectiveId: target.id },
      });
    }

    if (subItem) {
      await tx.subscriptionItem.update({
        where: { id: subItem.id },
        data: { courseId: target.id },
      });
    }
  });

  console.log("Applied.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
