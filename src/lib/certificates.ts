import crypto from "crypto";
import { db } from "./db";
import { notify } from "./audit";

function certificateCode(slug: string) {
  const prefix = slug.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase() || "UC";
  const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `UCA-${prefix}-${rand.slice(0, 4)}-${rand.slice(4)}`;
}

/**
 * A course is complete when every published lesson is completed and every
 * assignment in published modules has a passing grade. Issues a certificate
 * the first time both hold. Idempotent.
 */
export async function issueCertificateIfComplete(userId: string, courseId: string) {
  const existing = await db.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) return existing;

  const [lessons, progresses, assignments, grades] = await Promise.all([
    db.lesson.findMany({
      where: { module: { courseId, status: "PUBLISHED" } },
      select: { id: true },
    }),
    db.lessonProgress.findMany({
      where: { userId, completedAt: { not: null }, lesson: { module: { courseId, status: "PUBLISHED" } } },
      select: { lessonId: true },
    }),
    db.assignment.findMany({
      where: { module: { courseId, status: "PUBLISHED" } },
      select: { id: true },
    }),
    db.grade.findMany({
      where: { passed: true, submission: { userId, assignment: { module: { courseId, status: "PUBLISHED" } } } },
      select: { submission: { select: { assignmentId: true } } },
    }),
  ]);

  const completedLessons = new Set(progresses.map((p) => p.lessonId));
  const passedAssignments = new Set(grades.map((g) => g.submission.assignmentId));

  const lessonsDone = lessons.length > 0 && lessons.every((l) => completedLessons.has(l.id));
  const assignmentsDone = assignments.every((a) => passedAssignments.has(a.id));
  if (!lessonsDone || !assignmentsDone) return null;

  const course = await db.course.findUnique({ where: { id: courseId }, select: { slug: true, name: true } });
  if (!course) return null;

  const certificate = await db.certificate.create({
    data: { certificateId: certificateCode(course.slug), userId, courseId },
  });

  await notify({
    userId,
    type: "COURSE_COMPLETED",
    title: `Certificate earned: ${course.name}`,
    body: `You've completed ${course.name}. Your certificate ID is ${certificate.certificateId}.`,
  });

  return certificate;
}
