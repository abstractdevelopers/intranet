import { db } from "./db";
import { getLoggedWeeks, isModuleUnlocked } from "./captains-log";

export type ModuleAccess = {
  id: string;
  weekNumber: number;
  title: string;
  order: number;
  releaseAt: Date | null;
  complete: boolean;
  unlocked: boolean;
  lockedReason: "LOCKED_RELEASE" | "LOCKED_PREVIOUS" | "LOCKED_LOG" | null;
  doneLessons: number;
  totalLessons: number;
};

/**
 * Ordered module access states for one course. This is the single source of
 * truth behind the course timeline, and every lesson deep link re-checks it —
 * the timeline hiding something is never the only protection.
 */
export async function getModuleAccess(userId: string, courseId: string): Promise<ModuleAccess[]> {
  const [modules, loggedWeeks, user] = await Promise.all([
    db.module.findMany({
      where: { courseId, status: "PUBLISHED" },
      include: { lessons: { select: { id: true, progress: { where: { userId } } } } },
      orderBy: { order: "asc" },
    }),
    getLoggedWeeks(userId),
    db.user.findUnique({ where: { id: userId }, select: { previewUnreleasedContent: true } }),
  ]);
  const preview = user?.previewUnreleasedContent ?? false;

  const now = new Date();
  let previousComplete = true;
  return modules.map((mod) => {
    const totalLessons = mod.lessons.length;
    const doneLessons = mod.lessons.filter((l) => l.progress[0]?.completedAt).length;
    const complete = totalLessons > 0 && doneLessons === totalLessons;
    const { unlocked, reason } = isModuleUnlocked({
      releaseAt: mod.releaseAt,
      previousComplete,
      weekNumber: mod.weekNumber,
      loggedWeeks,
      now,
      preview,
    });
    if (!complete) previousComplete = false;
    return {
      id: mod.id,
      weekNumber: mod.weekNumber,
      title: mod.title,
      order: mod.order,
      releaseAt: mod.releaseAt,
      complete,
      unlocked,
      lockedReason: reason,
      doneLessons,
      totalLessons,
    };
  });
}

/**
 * Whether a specific lesson is released.
 *
 * A lesson's own releaseAt wins; null inherits the module's, so existing
 * content behaves exactly as before. `preview` skips the check for reviewer
 * accounts (see User.previewUnreleasedContent).
 *
 * The module gate is checked separately and first — this only answers the
 * day-within-the-week question.
 */
export function isLessonReleased(input: {
  lessonReleaseAt: Date | null;
  moduleReleaseAt: Date | null;
  now?: Date;
  preview?: boolean;
}) {
  if (input.preview) return true;
  const now = input.now ?? new Date();
  const effective = input.lessonReleaseAt ?? input.moduleReleaseAt;
  return !effective || effective <= now;
}

/**
 * Whether an assignment has opened.
 *
 * Assignments can open later than their week (a Monday week whose assignment
 * opens Wednesday), so an assignment's own releaseAt wins; null inherits the
 * module's. `preview` skips the check for reviewer accounts.
 */
export function isAssignmentReleased(input: {
  assignmentReleaseAt: Date | null;
  moduleReleaseAt: Date | null;
  now?: Date;
  preview?: boolean;
}) {
  if (input.preview) return true;
  const now = input.now ?? new Date();
  const effective = input.assignmentReleaseAt ?? input.moduleReleaseAt;
  return !effective || effective <= now;
}

/**
 * Whether a week quiz has opened.
 *
 * A quiz can open later than its week (a Monday week whose quiz is taken
 * Friday), so the quiz's own releaseAt wins; null inherits the module's.
 * `preview` skips the check for reviewer accounts.
 */
export function isQuizReleased(input: {
  quizReleaseAt: Date | null;
  moduleReleaseAt: Date | null;
  now?: Date;
  preview?: boolean;
}) {
  if (input.preview) return true;
  const now = input.now ?? new Date();
  const effective = input.quizReleaseAt ?? input.moduleReleaseAt;
  return !effective || effective <= now;
}

/**
 * Whether a specific module is currently accessible. Used by the module and
 * lesson pages so a direct URL can never bypass the timeline.
 */
export async function canAccessModule(userId: string, courseId: string, moduleId: string) {
  const access = await getModuleAccess(userId, courseId);
  const found = access.find((m) => m.id === moduleId);
  if (!found) return { allowed: false as const, reason: "NOT_FOUND" as const };
  if (!found.unlocked) {
    return { allowed: false as const, reason: found.lockedReason ?? "LOCKED_PREVIOUS" };
  }
  return { allowed: true as const, reason: null, module: found };
}
