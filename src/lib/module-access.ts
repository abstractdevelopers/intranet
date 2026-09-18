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
  const [modules, loggedWeeks] = await Promise.all([
    db.module.findMany({
      where: { courseId, status: "PUBLISHED" },
      include: { lessons: { select: { id: true, progress: { where: { userId } } } } },
      orderBy: { order: "asc" },
    }),
    getLoggedWeeks(userId),
  ]);

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
