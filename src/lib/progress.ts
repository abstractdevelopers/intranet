import { db } from "./db";

export type CourseProgress = {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  totalModules: number;
  completedModules: number;
  totalAssignments: number;
  submittedAssignments: number;
  percent: number;
};

/** Compute a student's real progress for one course — exactly 3 queries, no loops. */
export async function getCourseProgress(userId: string, courseId: string): Promise<CourseProgress> {
  const [modules, completions, submissions] = await Promise.all([
    db.module.findMany({
      where: { courseId, status: "PUBLISHED" },
      include: { lessons: { select: { id: true } }, assignments: { select: { id: true } } },
    }),
    db.lessonProgress.findMany({
      where: { userId, completedAt: { not: null }, lesson: { module: { courseId } } },
      select: { lessonId: true },
    }),
    db.assignmentSubmission.findMany({
      where: { userId, assignment: { module: { courseId } } },
      select: { assignmentId: true },
      distinct: ["assignmentId"],
    }),
  ]);

  const completedSet = new Set(completions.map((c) => c.lessonId));
  let completedLessons = 0;
  let completedModules = 0;
  let totalLessons = 0;
  let totalAssignments = 0;
  for (const m of modules) {
    const lessonIds = m.lessons.map((l) => l.id);
    totalLessons += lessonIds.length;
    totalAssignments += m.assignments.length;
    const done = lessonIds.filter((id) => completedSet.has(id)).length;
    completedLessons += done;
    if (lessonIds.length > 0 && done === lessonIds.length) completedModules += 1;
  }

  const totalUnits = totalLessons + totalAssignments;
  const doneUnits = completedLessons + submissions.length;
  const percent = totalUnits === 0 ? 0 : Math.round((doneUnits / totalUnits) * 100);

  return {
    courseId,
    totalLessons,
    completedLessons,
    totalModules: modules.length,
    completedModules,
    totalAssignments,
    submittedAssignments: submissions.length,
    percent,
  };
}
