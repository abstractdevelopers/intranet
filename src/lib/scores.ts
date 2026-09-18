import { db } from "./db";

/**
 * Score tracking (#10, #11).
 *
 * The percentage is calculated over every module that has actually been
 * *released* to the student, not over the modules that exist or the modules
 * the student chose to complete. A released-but-unsubmitted module counts as
 * a zero. That is deliberate: it stops a student from protecting an
 * artificially high score by simply avoiding work that is already available.
 */

export type ReleasedModule = {
  moduleId: string;
  courseId: string;
  courseName: string;
  courseSlug: string;
  weekNumber: number;
  title: string;
  releasedAt: Date;
  /** Every assignment in the released module, whether graded or not. */
  assignmentIds: string[];
  /** Sum of the student's graded scores across the module's assignments. */
  earned: number;
  /** Sum of maxScore across the module's assignments. */
  possible: number;
  gradedCount: number;
  submittedCount: number;
  percent: number;
};

export type ScoreSummary = {
  /** Percentage across every released module. */
  percent: number;
  earned: number;
  possible: number;
  releasedModules: number;
  gradedModules: number;
  /** Only used when no assignment exists yet, so the dashboard isn't blank. */
  hasScores: boolean;
};

export type ScoreBreakdown = {
  overall: ScoreSummary;
  weekly: (ScoreSummary & { weekNumber: number; label: string })[];
  monthly: (ScoreSummary & { monthKey: string; label: string })[];
  currentWeek: number | null;
};

function summarize(modules: ReleasedModule[]): ScoreSummary {
  const earned = modules.reduce((sum, m) => sum + m.earned, 0);
  const possible = modules.reduce((sum, m) => sum + m.possible, 0);
  const gradedModules = modules.filter((m) => m.gradedCount > 0).length;
  return {
    percent: possible === 0 ? 0 : Math.round((earned / possible) * 100),
    earned,
    possible,
    releasedModules: modules.length,
    gradedModules,
    hasScores: possible > 0,
  };
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-NG", { month: "long", year: "numeric" });
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Every module released to the student across their accepted courses, with the
 * score they have earned in each. Three queries, no per-module round trips.
 */
export async function getReleasedModules(
  userId: string,
  courseIds?: string[]
): Promise<ReleasedModule[]> {
  const enrollments = await db.enrollment.findMany({
    where: {
      userId,
      status: "ACCEPTED",
      ...(courseIds?.length ? { courseId: { in: courseIds } } : {}),
    },
    select: { courseId: true },
  });
  const acceptedCourseIds = enrollments.map((e) => e.courseId);
  if (acceptedCourseIds.length === 0) return [];

  const now = new Date();
  const [modules, submissions, grades] = await Promise.all([
    db.module.findMany({
      where: {
        courseId: { in: acceptedCourseIds },
        status: "PUBLISHED",
        OR: [{ releaseAt: null }, { releaseAt: { lte: now } }],
      },
      select: {
        id: true,
        courseId: true,
        weekNumber: true,
        title: true,
        releaseAt: true,
        createdAt: true,
        course: { select: { name: true, slug: true } },
        assignments: { select: { id: true, maxScore: true } },
      },
      orderBy: [{ weekNumber: "asc" }],
    }),
    db.assignmentSubmission.findMany({
      where: { userId, assignment: { module: { courseId: { in: acceptedCourseIds } } } },
      select: { assignmentId: true },
      distinct: ["assignmentId"],
    }),
    db.grade.findMany({
      where: { submission: { userId } },
      select: { score: true, maxScore: true, submission: { select: { assignmentId: true } } },
      orderBy: { gradedAt: "desc" },
    }),
  ]);

  const submitted = new Set(submissions.map((s) => s.assignmentId));
  // Latest grade per assignment wins (a revision can be re-graded).
  const gradeByAssignment = new Map<string, { score: number; maxScore: number }>();
  for (const g of grades) {
    const assignmentId = g.submission.assignmentId;
    if (!gradeByAssignment.has(assignmentId)) {
      gradeByAssignment.set(assignmentId, { score: g.score, maxScore: g.maxScore });
    }
  }

  return modules.map((m) => {
    const assignmentIds = m.assignments.map((a) => a.id);
    let earned = 0;
    let possible = 0;
    let gradedCount = 0;
    for (const a of m.assignments) {
      const grade = gradeByAssignment.get(a.id);
      // A released assignment always contributes its full weight, graded or not.
      possible += grade?.maxScore ?? a.maxScore;
      if (grade) {
        earned += grade.score;
        gradedCount += 1;
      }
    }
    let submittedCount = 0;
    for (const id of assignmentIds) if (submitted.has(id)) submittedCount += 1;

    return {
      moduleId: m.id,
      courseId: m.courseId,
      courseName: m.course.name,
      courseSlug: m.course.slug,
      weekNumber: m.weekNumber,
      title: m.title,
      releasedAt: m.releaseAt ?? m.createdAt,
      assignmentIds,
      earned,
      possible,
      gradedCount,
      submittedCount,
      percent: possible === 0 ? 0 : Math.round((earned / possible) * 100),
    };
  });
}

/**
 * Overall + weekly + monthly performance. Weekly groups by the calendar week a
 * module was released; monthly groups by release month.
 */
export async function getScoreBreakdown(
  userId: string,
  released?: ReleasedModule[]
): Promise<ScoreBreakdown> {
  const modules = released ?? (await getReleasedModules(userId));

  const byWeek = new Map<string, ReleasedModule[]>();
  const byMonth = new Map<string, ReleasedModule[]>();
  for (const m of modules) {
    const weekKey = `${m.releasedAt.getFullYear()}-W${String(isoWeek(m.releasedAt)).padStart(2, "0")}`;
    byWeek.set(weekKey, [...(byWeek.get(weekKey) ?? []), m]);
    const mKey = monthKey(m.releasedAt);
    byMonth.set(mKey, [...(byMonth.get(mKey) ?? []), m]);
  }

  const weekly = [...byWeek.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, mods]) => {
      const date = mods[0].releasedAt;
      return {
        ...summarize(mods),
        weekNumber: isoWeek(date),
        label: `Week of ${date.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}`,
      };
    });

  const monthly = [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, mods]) => ({
      ...summarize(mods),
      monthKey: key,
      label: monthLabel(mods[0].releasedAt),
    }));

  const thisWeek = isoWeek(new Date());
  const thisWeekYear = new Date().getFullYear();
  const currentModule = modules.find(
    (m) => isoWeek(m.releasedAt) === thisWeek && m.releasedAt.getFullYear() === thisWeekYear
  );

  return {
    overall: summarize(modules),
    weekly,
    monthly,
    currentWeek: currentModule ? thisWeek : null,
  };
}

/** Convenience for surfaces that only need the headline number. */
export async function getOverallScore(userId: string): Promise<ScoreSummary> {
  return summarize(await getReleasedModules(userId));
}
