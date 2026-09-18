import { db } from "./db";
import { CAPTAIN_LOG_QUESTIONS } from "./constants";

export type CaptainLogResponses = Record<string, string>;

export function parseResponses(raw: string): CaptainLogResponses {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as CaptainLogResponses;
    }
  } catch {
    /* fall through */
  }
  return {};
}

export function validateResponses(input: unknown): {
  ok: true; responses: CaptainLogResponses;
} | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Answer the Captain's Log questions before submitting." };
  }
  const record = input as Record<string, unknown>;
  const responses: CaptainLogResponses = {};
  for (const question of CAPTAIN_LOG_QUESTIONS) {
    const value = String(record[question.id] ?? "").trim();
    if (!value) {
      return { ok: false, error: `Please answer: ${question.label}` };
    }
    if (value.length > 4000) {
      return { ok: false, error: `That answer is too long. Keep it under 4000 characters.` };
    }
    responses[question.id] = value;
  }
  return { ok: true, responses };
}

/**
 * The week a student is currently working on: the highest week whose content is
 * actually unlocked across their courses. Using "unlocked" rather than
 * "released" matters — a student held back by a missing log must be asked for
 * the week they have not reflected on yet, not the one they cannot open.
 */
type WeekModule = {
  id: string;
  courseId: string;
  weekNumber: number;
  order: number;
  releaseAt: Date | null;
  lessons: { id: string; progress: { completedAt: Date | null }[] }[];
};

/**
 * The highest unlocked week per course, from already-fetched modules. Unlocking
 * requires the module to be released, the previous module to be complete, and
 * the previous week's Captain's Log to be submitted. Week 1 never needs a log.
 */
function unlockedWeeksByCourse(
  modules: WeekModule[],
  loggedWeeks: Set<number>,
  now: Date
): Map<string, number> {
  const byCourse = new Map<string, WeekModule[]>();
  for (const mod of modules) {
    byCourse.set(mod.courseId, [...(byCourse.get(mod.courseId) ?? []), mod]);
  }

  const highestByCourse = new Map<string, number>();
  for (const [courseId, courseModules] of byCourse) {
    let previousComplete = true;
    let highest = 0;
    for (const mod of courseModules) {
      const totalLessons = mod.lessons.length;
      const doneLessons = mod.lessons.filter((l) => l.progress[0]?.completedAt).length;
      const complete = totalLessons > 0 && doneLessons === totalLessons;
      const released = !mod.releaseAt || mod.releaseAt <= now;
      const logSatisfied = mod.weekNumber <= 1 || loggedWeeks.has(mod.weekNumber - 1);
      if (released && previousComplete && logSatisfied) {
        highest = Math.max(highest, mod.weekNumber);
      }
      if (!complete) previousComplete = false;
    }
    highestByCourse.set(courseId, highest);
  }
  return highestByCourse;
}

export async function getCurrentWeek(userId: string): Promise<number | null> {
  const enrollments = await db.enrollment.findMany({
    where: { userId, status: "ACCEPTED" },
    select: { courseId: true },
  });
  if (enrollments.length === 0) return null;

  const [loggedWeeks, modules] = await Promise.all([
    getLoggedWeeks(userId),
    db.module.findMany({
      where: { courseId: { in: enrollments.map((e) => e.courseId) }, status: "PUBLISHED" },
      select: {
        id: true,
        courseId: true,
        weekNumber: true,
        order: true,
        releaseAt: true,
        lessons: { select: { id: true, progress: { where: { userId }, select: { completedAt: true } } } },
      },
      orderBy: [{ courseId: "asc" }, { order: "asc" }],
    }),
  ]);

  const highestByCourse = unlockedWeeksByCourse(modules, loggedWeeks, new Date());
  let highest: number | null = null;
  for (const week of highestByCourse.values()) {
    if (week > 0 && (highest === null || week > highest)) highest = week;
  }
  return highest;
}

export type CaptainLogState = {
  /** Highest released week number, or null when nothing is released yet. */
  currentWeek: number | null;
  /** True when the current week's log is still outstanding. */
  required: boolean;
  /** The log for the current week, if submitted. */
  log: {
    id: string;
    weekNumber: number;
    status: string;
    submittedAt: Date;
    responses: CaptainLogResponses;
  } | null;
  /** Whether next week's content is being held back by a missing log. */
  blocking: boolean;
};

/**
 * Captain's Log state for a student. The log for week N must be submitted
 * before week N+1 content unlocks — that is the `blocking` flag.
 */
export async function getCaptainLogState(userId: string): Promise<CaptainLogState> {
  const currentWeek = await getCurrentWeek(userId);
  if (currentWeek === null) {
    return { currentWeek: null, required: false, log: null, blocking: false };
  }

  const log = await db.captainLog.findUnique({
    where: { userId_weekNumber: { userId, weekNumber: currentWeek } },
  });

  return {
    currentWeek,
    required: !log,
    log: log
      ? {
          id: log.id,
          weekNumber: log.weekNumber,
          status: log.status,
          submittedAt: log.submittedAt,
          responses: parseResponses(log.responses),
        }
      : null,
    blocking: !log,
  };
}

/**
 * Academy-wide Captain's Log compliance (#18). A week is "due" once a student
 * has actually reached it — released *and* unlocked by their own progress.
 * Counting locked weeks would penalise students for content they cannot open.
 */
export async function getCaptainLogCompliance(): Promise<{
  due: number;
  submitted: number;
  missing: number;
  rate: number;
  awaitingReview: number;
}> {
  const students = await db.user.findMany({
    where: { role: "STUDENT", status: "ACTIVE", onboardingCompletedAt: { not: null } },
    select: {
      id: true,
      captainLogs: { select: { weekNumber: true, status: true } },
      enrollments: { where: { status: "ACCEPTED" }, select: { courseId: true } },
    },
  });

  const enrollmentsByCourse = new Map<string, Set<string>>();
  for (const student of students) {
    for (const enrollment of student.enrollments) {
      const set = enrollmentsByCourse.get(enrollment.courseId) ?? new Set<string>();
      set.add(student.id);
      enrollmentsByCourse.set(enrollment.courseId, set);
    }
  }

  const courseIds = [...enrollmentsByCourse.keys()];
  if (courseIds.length === 0) {
    return { due: 0, submitted: 0, missing: 0, rate: 0, awaitingReview: 0 };
  }

  // Two batched queries cover every student — never query per student.
  const [modules, progress] = await Promise.all([
    db.module.findMany({
      where: { courseId: { in: courseIds }, status: "PUBLISHED" },
      select: {
        id: true,
        courseId: true,
        weekNumber: true,
        order: true,
        releaseAt: true,
        lessons: { select: { id: true } },
      },
      orderBy: [{ courseId: "asc" }, { order: "asc" }],
    }),
    db.lessonProgress.findMany({
      where: {
        completedAt: { not: null },
        userId: { in: students.map((s) => s.id) },
      },
      select: { userId: true, lessonId: true },
    }),
  ]);

  const completedByUser = new Map<string, Set<string>>();
  for (const row of progress) {
    const set = completedByUser.get(row.userId) ?? new Set<string>();
    set.add(row.lessonId);
    completedByUser.set(row.userId, set);
  }

  const modulesByCourse = new Map<string, typeof modules>();
  for (const mod of modules) {
    modulesByCourse.set(mod.courseId, [...(modulesByCourse.get(mod.courseId) ?? []), mod]);
  }

  const now = new Date();
  let due = 0;
  let submitted = 0;
  let awaitingReview = 0;

  for (const student of students) {
    if (student.enrollments.length === 0) continue;
    const logged = new Set(student.captainLogs.map((l) => l.weekNumber));
    const completed = completedByUser.get(student.id) ?? new Set<string>();

    let reachedWeek = 0;
    for (const enrollment of student.enrollments) {
      const courseModules = modulesByCourse.get(enrollment.courseId) ?? [];
      let previousComplete = true;
      for (const mod of courseModules) {
        const totalLessons = mod.lessons.length;
        const doneLessons = mod.lessons.filter((l) => completed.has(l.id)).length;
        const complete = totalLessons > 0 && doneLessons === totalLessons;
        const released = !mod.releaseAt || mod.releaseAt <= now;
        const logSatisfied = mod.weekNumber <= 1 || logged.has(mod.weekNumber - 1);
        if (released && previousComplete && logSatisfied) {
          reachedWeek = Math.max(reachedWeek, mod.weekNumber);
        }
        if (!complete) previousComplete = false;
      }
    }

    for (let week = 1; week <= reachedWeek; week += 1) {
      due += 1;
      if (logged.has(week)) submitted += 1;
    }
    awaitingReview += student.captainLogs.filter((l) => l.status === "SUBMITTED").length;
  }

  const missing = Math.max(0, due - submitted);
  return {
    due,
    submitted,
    missing,
    rate: due > 0 ? Math.round((submitted / due) * 100) : 0,
    awaitingReview,
  };
}

/**
 * Whether a module may be unlocked. It must be released, the previous module
 * in the same course must be complete, and the Captain's Log for the week the
 * module belongs to minus one must be submitted.
 *
 * `logWeeks` is the set of week numbers the student has already logged —
 * passed in so callers can batch the lookup.
 */
export function isModuleUnlocked(input: {
  releaseAt: Date | null;
  previousComplete: boolean;
  weekNumber: number;
  loggedWeeks: Set<number>;
  now?: Date;
}): { unlocked: boolean; reason: "LOCKED_RELEASE" | "LOCKED_PREVIOUS" | "LOCKED_LOG" | null } {
  const now = input.now ?? new Date();
  if (input.releaseAt && input.releaseAt > now) {
    return { unlocked: false, reason: "LOCKED_RELEASE" };
  }
  if (!input.previousComplete) {
    return { unlocked: false, reason: "LOCKED_PREVIOUS" };
  }
  // Week 1 has no preceding week to reflect on.
  if (input.weekNumber > 1 && !input.loggedWeeks.has(input.weekNumber - 1)) {
    return { unlocked: false, reason: "LOCKED_LOG" };
  }
  return { unlocked: true, reason: null };
}

/** Week numbers this student has submitted a Captain's Log for. */
export async function getLoggedWeeks(userId: string): Promise<Set<number>> {
  const logs = await db.captainLog.findMany({
    where: { userId },
    select: { weekNumber: true },
  });
  return new Set(logs.map((l) => l.weekNumber));
}
