import { db } from "./db";
import { notify } from "./audit";
import { getModuleAccess } from "./module-access";
import { getCaptainLogState } from "./captains-log";

/**
 * Notification triggers (#13).
 *
 * These run on read rather than on a schedule: the dashboard and notification
 * page call `syncStudentNotifications`, which notices what has become true
 * since it last ran and records each event exactly once. That avoids a cron job
 * and works on serverless.
 *
 * Deliberately batched: one read to collect existing dedupe keys, then one set
 * of reads for the source data, then writes only for genuinely new events.
 */

/** How far ahead an approaching deadline starts warning. */
const DEADLINE_WARNING_DAYS = 2;

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

type Candidate = {
  type: string;
  title: string;
  body: string;
  dedupeKey: string;
};

/** Pull the dedupe keys out of previously stored notification metadata. */
function collectDedupeKeys(notifications: { metadata: string | null }[]) {
  const keys = new Set<string>();
  for (const n of notifications) {
    if (!n.metadata) continue;
    try {
      const parsed = JSON.parse(n.metadata) as { dedupe?: string };
      if (parsed.dedupe) keys.add(parsed.dedupe);
    } catch {
      /* metadata isn't JSON — nothing to dedupe against */
    }
  }
  return keys;
}

/**
 * Bring a student's notifications up to date. Safe to call on every dashboard
 * render — each event is recorded at most once.
 */
export async function syncStudentNotifications(userId: string) {
  const enrollments = await db.enrollment.findMany({
    where: { userId, status: "ACCEPTED" },
    select: { courseId: true, course: { select: { name: true } } },
  });
  if (enrollments.length === 0) return;

  const now = new Date();
  const courseIds = enrollments.map((e) => e.courseId);

  const [existing, captainLog, moduleAccessByCourse] = await Promise.all([
    db.notification.findMany({
      where: {
        userId,
        type: { in: ["MODULE_AVAILABLE", "ASSIGNMENT_DUE", "CAPTAIN_LOG_REQUIRED"] },
      },
      select: { metadata: true },
    }),
    getCaptainLogState(userId),
    Promise.all(
      enrollments.map(async (e) => ({
        courseName: e.course.name,
        modules: await getModuleAccess(userId, e.courseId),
      }))
    ),
  ]);

  const seen = collectDedupeKeys(existing);
  const candidates: Candidate[] = [];

  const push = (candidate: Candidate) => {
    if (seen.has(candidate.dedupeKey)) return;
    seen.add(candidate.dedupeKey);
    candidates.push(candidate);
  };

  // Newly unlocked weeks.
  for (const { courseName, modules } of moduleAccessByCourse) {
    for (const mod of modules) {
      if (!mod.unlocked) continue;
      push({
        type: "MODULE_AVAILABLE",
        title: `New week available: ${mod.title}`,
        body: `Week ${mod.weekNumber} of ${courseName} is now open.`,
        dedupeKey: `module-available:${mod.id}`,
      });
    }
  }

  // Deadlines approaching on work that hasn't been submitted.
  const warningCutoff = new Date(now.getTime() + DEADLINE_WARNING_DAYS * 86400000);
  const dueSoon = await db.assignment.findMany({
    where: {
      module: { courseId: { in: courseIds }, status: "PUBLISHED" },
      deadline: { gt: now, lte: warningCutoff },
      submissions: { none: { userId } },
    },
    select: {
      id: true,
      title: true,
      deadline: true,
      module: { select: { weekNumber: true, course: { select: { name: true } } } },
    },
  });

  for (const assignment of dueSoon) {
    if (!assignment.deadline) continue;
    push({
      type: "ASSIGNMENT_DUE",
      title: `Deadline approaching: ${assignment.title}`,
      body: `${assignment.module.course.name} · Week ${assignment.module.weekNumber} — due ${assignment.deadline.toLocaleDateString("en-NG", { day: "numeric", month: "long" })}.`,
      dedupeKey: `assignment-due:${assignment.id}:${dayKey(assignment.deadline)}`,
    });
  }

  // The Captain's Log is outstanding and is holding back the next week.
  if (captainLog.required && captainLog.currentWeek !== null) {
    push({
      type: "CAPTAIN_LOG_REQUIRED",
      title: `Captain's Log required — Week ${captainLog.currentWeek}`,
      body: "Next week's content stays locked until you submit your reflection.",
      dedupeKey: `captain-log-required:${captainLog.currentWeek}`,
    });
  }

  for (const candidate of candidates) {
    await notify({
      userId,
      type: candidate.type,
      title: candidate.title,
      body: candidate.body,
      metadata: { dedupe: candidate.dedupeKey },
    });
  }
}