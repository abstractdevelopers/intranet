import { db } from "./db";

/**
 * Score tracking.
 *
 * A week's score is a weighted blend of the two kinds of graded work:
 *
 *   week = (assignmentPercent × 0.7) + (quizPercent × 0.3)
 *
 * Each component is taken only over the work the week actually contains, so a
 * week with no quiz is not capped at 70% and a week with no assignment is not
 * capped at 30%. When a week has only one kind, that kind carries full weight.
 *
 * Missing work counts as zero. `possible` includes every released assignment
 * and quiz whether submitted or not, which stops a student from protecting an
 * average by avoiding work that is already available.
 */

/** Weight of assignments against quizzes, when a week has both. */
export const ASSIGNMENT_WEIGHT = 0.7;
export const QUIZ_WEIGHT = 0.3;

export type ReleasedModule = {
  moduleId: string;
  courseId: string;
  courseName: string;
  courseSlug: string;
  weekNumber: number;
  title: string;
  releasedAt: Date;
  assignmentIds: string[];
  /** Assignment points earned vs available. */
  assignmentEarned: number;
  assignmentPossible: number;
  /** Share of the quiz marks earned, 0-100. */
  quizPercent: number;
  quizCount: number;
  quizTaken: number;
  gradedCount: number;
  submittedCount: number;
  /** Blended 0-100 score for the week. */
  percent: number;
  hasAssignments: boolean;
  hasQuizzes: boolean;
};

export type ScoreSummary = {
  percent: number;
  earned: number;
  possible: number;
  releasedModules: number;
  gradedModules: number;
  hasScores: boolean;
};

export type ScoreBreakdown = {
  overall: ScoreSummary;
  weekly: (ScoreSummary & { weekNumber: number; label: string })[];
  monthly: (ScoreSummary & { monthKey: string; label: string })[];
  currentWeek: number | null;
};

/**
 * Blend one week's two components.
 *
 * Weights are renormalised over whichever components exist, so a quiz-only week
 * is scored on the quiz alone rather than being dragged down by an assignment
 * it never had.
 */
function blendWeek(
  assignmentPercent: number,
  quizPercent: number,
  hasAssignments: boolean,
  hasQuizzes: boolean,
) {
  if (hasAssignments && hasQuizzes) {
    return Math.round(assignmentPercent * ASSIGNMENT_WEIGHT + quizPercent * QUIZ_WEIGHT);
  }
  if (hasAssignments) return Math.round(assignmentPercent);
  if (hasQuizzes) return Math.round(quizPercent);
  return 0;
}

function summarize(modules: ReleasedModule[]): ScoreSummary {
  const scored = modules.filter((m) => m.hasAssignments || m.hasQuizzes);
  if (scored.length === 0) {
    return {
      percent: 0,
      earned: 0,
      possible: 0,
      releasedModules: modules.length,
      gradedModules: 0,
      hasScores: false,
    };
  }
  // The overall figure is the mean of the weekly percentages, so a week with
  // several quizzes cannot outweigh a week with a single assignment.
  const percent = Math.round(scored.reduce((sum, m) => sum + m.percent, 0) / scored.length);
  return {
    percent,
    earned: scored.reduce((sum, m) => sum + m.assignmentEarned, 0),
    possible: scored.reduce((sum, m) => sum + m.assignmentPossible, 0),
    releasedModules: modules.length,
    gradedModules: scored.filter((m) => m.gradedCount > 0 || m.quizTaken > 0).length,
    hasScores: true,
  };
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-NG", { month: "long", year: "numeric" });
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Every module released to the student across their accepted courses, with the
 * score for each. Four queries, no per-module round trips.
 */
export async function getReleasedModules(userId: string, courseIds?: string[]): Promise<ReleasedModule[]> {
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
  const [modules, submissions, grades, quizAttempts] = await Promise.all([
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
        quizzes: {
          where: { status: "PUBLISHED", OR: [{ releaseAt: null }, { releaseAt: { lte: now } }] },
          select: { id: true },
        },
      },
      orderBy: [{ courseId: "asc" }, { weekNumber: "asc" }],
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
    db.quizAttempt.findMany({
      where: { userId, quiz: { module: { courseId: { in: acceptedCourseIds } } } },
      select: { quizId: true, score: true },
    }),
  ]);

  const submitted = new Set(submissions.map((s) => s.assignmentId));
  // Newest grade per assignment wins: a revision can be re-graded, and the
  // later mark is the one that stands.
  const gradeByAssignment = new Map<string, { score: number; maxScore: number }>();
  for (const g of grades) {
    const assignmentId = g.submission.assignmentId;
    if (!gradeByAssignment.has(assignmentId)) {
      gradeByAssignment.set(assignmentId, { score: g.score, maxScore: g.maxScore });
    }
  }

  // Best attempt per quiz. Quiz scores are percentages of the questions, so the
  // best one fairly represents what the student can do.
  const bestQuiz = new Map<string, number>();
  for (const a of quizAttempts) {
    const prev = bestQuiz.get(a.quizId);
    if (prev === undefined || a.score > prev) bestQuiz.set(a.quizId, a.score);
  }

  return modules.map((m) => {
    const assignmentIds = m.assignments.map((a) => a.id);

    let assignmentEarned = 0;
    let assignmentPossible = 0;
    let gradedCount = 0;
    for (const a of m.assignments) {
      const grade = gradeByAssignment.get(a.id);
      assignmentPossible += grade?.maxScore ?? a.maxScore;
      if (grade) {
        assignmentEarned += grade.score;
        gradedCount += 1;
      }
    }
    const assignmentPercent = assignmentPossible === 0 ? 0 : (assignmentEarned / assignmentPossible) * 100;

    let quizSum = 0;
    let quizTaken = 0;
    for (const q of m.quizzes) {
      const best = bestQuiz.get(q.id);
      // An untaken quiz still counts, as a zero, so it weighs on the week.
      if (best !== undefined) {
        quizSum += best;
        quizTaken += 1;
      }
    }
    const quizPercent = m.quizzes.length === 0 ? 0 : quizSum / m.quizzes.length;

    const hasAssignments = m.assignments.length > 0;
    const hasQuizzes = m.quizzes.length > 0;

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
      assignmentEarned,
      assignmentPossible,
      quizPercent: Math.round(quizPercent),
      quizCount: m.quizzes.length,
      quizTaken,
      gradedCount,
      submittedCount,
      percent: blendWeek(assignmentPercent, quizPercent, hasAssignments, hasQuizzes),
      hasAssignments,
      hasQuizzes,
    };
  });
}

/**
 * Overall + weekly + monthly performance.
 *
 * Weekly groups by the academy's own week numbers, not the calendar week, so
 * the scoreboard reads "Week 3" in step with the course pages.
 */
export async function getScoreBreakdown(
  userId: string,
  released?: ReleasedModule[],
): Promise<ScoreBreakdown> {
  const modules = released ?? (await getReleasedModules(userId));

  const byWeek = new Map<number, ReleasedModule[]>();
  const byMonth = new Map<string, ReleasedModule[]>();
  for (const m of modules) {
    byWeek.set(m.weekNumber, [...(byWeek.get(m.weekNumber) ?? []), m]);
    const mKey = monthKey(m.releasedAt);
    byMonth.set(mKey, [...(byMonth.get(mKey) ?? []), m]);
  }

  const weekly = [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([weekNumber, mods]) => ({
      ...summarize(mods),
      weekNumber,
      label: `Week ${weekNumber}`,
    }));

  const monthly = [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, mods]) => ({
      ...summarize(mods),
      monthKey: key,
      label: monthLabel(mods[0].releasedAt),
    }));

  return {
    overall: summarize(modules),
    weekly,
    monthly,
    currentWeek: modules.length > 0 ? Math.max(...modules.map((m) => m.weekNumber)) : null,
  };
}

/** Convenience for surfaces that only need the headline number. */
export async function getOverallScore(userId: string): Promise<ScoreSummary> {
  return summarize(await getReleasedModules(userId));
}
