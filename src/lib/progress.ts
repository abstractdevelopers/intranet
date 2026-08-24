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

/** Compute a student's real progress for one course from lessons and submissions. */
export async function getCourseProgress(userId: string, courseId: string): Promise<CourseProgress> {
  const modules = await db.module.findMany({
    where: { courseId, status: "PUBLISHED" },
    include: { lessons: { select: { id: true } }, assignments: { select: { id: true } } },
  });

  const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
  const assignmentIds = modules.flatMap((m) => m.assignments.map((a) => a.id));

  const [completedLessons, submissions] = await Promise.all([
    lessonIds.length
      ? db.lessonProgress.count({
          where: { userId, lessonId: { in: lessonIds }, completedAt: { not: null } },
        })
      : 0,
    assignmentIds.length
      ? db.assignmentSubmission.findMany({
          where: { userId, assignmentId: { in: assignmentIds } },
          select: { assignmentId: true },
          distinct: ["assignmentId"],
        })
      : [],
  ]);

  const totalLessons = lessonIds.length;
  const totalAssignments = assignmentIds.length;
  const totalModules = modules.length;

  // A module is complete when all of its lessons are complete.
  let completedModules = 0;
  for (const m of modules) {
    if (m.lessons.length === 0) continue;
    const done = await db.lessonProgress.count({
      where: {
        userId,
        lessonId: { in: m.lessons.map((l) => l.id) },
        completedAt: { not: null },
      },
    });
    if (done === m.lessons.length) completedModules += 1;
  }

  const totalUnits = totalLessons + totalAssignments;
  const doneUnits = completedLessons + submissions.length;
  const percent = totalUnits === 0 ? 0 : Math.round((doneUnits / totalUnits) * 100);

  return {
    courseId,
    totalLessons,
    completedLessons,
    totalModules,
    completedModules,
    totalAssignments,
    submittedAssignments: submissions.length,
    percent,
  };
}
