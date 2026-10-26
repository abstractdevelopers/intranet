import { db } from "./db";
import { ASSIGNMENT_WEIGHT, QUIZ_WEIGHT } from "./scores";

/**
 * Where a student stands against the rest of their course.
 *
 * Ranked within a course rather than across the academy: students sit one
 * compulsory and one elective, so comparing a video editor's edit against a
 * graphic designer's flyer would mostly measure the course, not the student.
 *
 * Only students with at least one graded item are ranked. A student who has not
 * started would otherwise sit at the bottom by default, which says nothing
 * about their work.
 *
 * The score mirrors lib/scores: a week is 70% assignment, 30% quiz, and a
 * student's course figure is the mean of their weeks. Everything is fetched for
 * all of the student's courses in one pass — four queries in total — because
 * each round trip to the pooled database costs the better part of a second.
 */

export type LeaderRow = {
  userId: string;
  name: string;
  percent: number;
  weeksScored: number;
  isMe: boolean;
};

export type CourseStanding = {
  courseId: string;
  courseName: string;
  courseSlug: string;
  rank: number | null;
  rankedStudents: number;
  myPercent: number;
  /** Rows around the student, so the list stays short. */
  around: LeaderRow[];
};

const WINDOW = 2;
/** Most rows to show around a student, either side. */
const TOP_COUNT = 3;

function displayName(profile: { fullName: string } | null, email: string) {
  return profile?.fullName?.trim() || email.split("@")[0];
}

function blend(asgPct: number, quizPct: number, hasAsg: boolean, hasQuiz: boolean) {
  if (hasAsg && hasQuiz) return asgPct * ASSIGNMENT_WEIGHT + quizPct * QUIZ_WEIGHT;
  if (hasAsg) return asgPct;
  if (hasQuiz) return quizPct;
  return 0;
}

/** Course standings for one student, ranked within each enrolled course. */
export async function getCourseStandings(userId: string): Promise<CourseStanding[]> {
  const now = new Date();

  const enrollments = await db.enrollment.findMany({
    where: { userId, status: "ACCEPTED" },
    select: { course: { select: { id: true, name: true, slug: true } } },
  });
  if (enrollments.length === 0) return [];
  const courseIds = enrollments.map((e) => e.course.id);

  const [peers, modules, grades, attempts] = await Promise.all([
    db.enrollment.findMany({
      where: { courseId: { in: courseIds }, status: "ACCEPTED" },
      select: {
        courseId: true,
        userId: true,
        user: { select: { email: true, profile: { select: { fullName: true } } } },
      },
    }),
    db.module.findMany({
      where: {
        courseId: { in: courseIds },
        status: "PUBLISHED",
        OR: [{ releaseAt: null }, { releaseAt: { lte: now } }],
      },
      select: {
        id: true,
        courseId: true,
        weekNumber: true,
        assignments: { select: { id: true, maxScore: true } },
        quizzes: {
          where: { status: "PUBLISHED", OR: [{ releaseAt: null }, { releaseAt: { lte: now } }] },
          select: { id: true },
        },
      },
      orderBy: [{ courseId: "asc" }, { weekNumber: "asc" }],
    }),
    db.grade.findMany({
      where: { submission: { assignment: { module: { courseId: { in: courseIds } } } } },
      select: {
        score: true,
        gradedAt: true,
        submission: { select: { userId: true, assignmentId: true } },
      },
      orderBy: { gradedAt: "desc" },
    }),
    db.quizAttempt.findMany({
      where: { quiz: { module: { courseId: { in: courseIds } } } },
      select: { userId: true, quizId: true, score: true },
    }),
  ]);

  // --- index the fetched rows -----------------------------------------------
  const moduleCourse = new Map<string, string>();
  const assignmentWeek = new Map<string, { moduleId: string; maxScore: number }>();
  const quizzesByModule = new Map<string, string[]>();

  for (const m of modules) {
    moduleCourse.set(m.id, m.courseId);
    for (const a of m.assignments) assignmentWeek.set(a.id, { moduleId: m.id, maxScore: a.maxScore });
    if (m.quizzes.length) quizzesByModule.set(m.id, m.quizzes.map((q) => q.id));
  }

  // Best attempt per quiz.
  const bestQuiz = new Map<string, number>(); // `${userId}|${quizId}` -> score
  for (const a of attempts) {
    const key = `${a.userId}|${a.quizId}`;
    const prev = bestQuiz.get(key);
    if (prev === undefined || a.score > prev) bestQuiz.set(key, a.score);
  }

  // --- compute every student's score per course -----------------------------
  type Agg = { earned: Map<string, number>; total: Map<string, number>; touched: boolean };
  const agg = new Map<string, Agg>(); // `${courseId}|${userId}`
  const getAgg = (courseId: string, id: string) => {
    const key = `${courseId}|${id}`;
    let a = agg.get(key);
    if (!a) {
      a = { earned: new Map(), total: new Map(), touched: false };
      agg.set(key, a);
    }
    return a;
  };

  for (const peer of peers) {
    const a = getAgg(peer.courseId, peer.userId);
    // Every released assignment contributes its full weight, graded or not, so
    // skipping available work cannot protect an average.
    for (const m of modules) {
      if (m.courseId !== peer.courseId || m.assignments.length === 0) continue;
      const sum = m.assignments.reduce((s, x) => s + x.maxScore, 0);
      a.total.set(m.id, (a.total.get(m.id) ?? 0) + sum);
    }
    // Likewise, every released week counts even with nothing submitted. A week
    // the student has not touched is a zero, not an absence — otherwise
    // skipping a week would lift their average.
    if (modules.some((m) => m.courseId === peer.courseId)) a.touched = true;
  }

  // Only the newest grade per assignment is added. Comparing against the best
  // score instead would still add an assignment twice when the same mark was
  // awarded more than once, which is how a week reached 142%.
  const credited = new Set<string>(); // `${userId}|${assignmentId}`
  for (const g of grades) {
    const meta = assignmentWeek.get(g.submission.assignmentId);
    if (!meta) continue;
    const courseId = moduleCourse.get(meta.moduleId);
    if (!courseId) continue;
    const key = `${g.submission.userId}|${g.submission.assignmentId}`;
    if (credited.has(key)) continue;
    credited.add(key);
    const a = getAgg(courseId, g.submission.userId);
    a.earned.set(meta.moduleId, (a.earned.get(meta.moduleId) ?? 0) + g.score);
    a.touched = true;
  }

  // Quiz marks: best attempt per quiz, averaged over the module's quizzes.
  const quizModule = new Map<string, string>(); // quizId -> moduleId
  for (const [moduleId, ids] of quizzesByModule) for (const id of ids) quizModule.set(id, moduleId);

  const quizSum = new Map<string, number>(); // `${courseId}|${userId}|${moduleId}` -> sum of bests
  // Counted once per quiz. Matching on score instead would add a quiz twice
  // whenever a student scored the same twice, which pushed weeks past 100%.
  const quizCounted = new Set<string>(); // `${userId}|${quizId}`
  for (const a of attempts) {
    const moduleId = quizModule.get(a.quizId);
    if (!moduleId) continue;
    const courseId = moduleCourse.get(moduleId);
    if (!courseId) continue;
    const seen = `${a.userId}|${a.quizId}`;
    if (quizCounted.has(seen)) continue;
    quizCounted.add(seen);

    const best = bestQuiz.get(seen) ?? 0;
    const key = `${courseId}|${a.userId}|${moduleId}`;
    quizSum.set(key, (quizSum.get(key) ?? 0) + best);
    if (best > 0) getAgg(courseId, a.userId).touched = true;
  }

  // --- rank per course ------------------------------------------------------
  const standings: CourseStanding[] = enrollments.map((enrollment) => {
    const course = enrollment.course;

    const rows: LeaderRow[] = [];
    for (const peer of peers) {
      if (peer.courseId !== course.id) continue;
      const a = agg.get(`${course.id}|${peer.userId}`);
      if (!a || !a.touched) continue;

      const weeks: number[] = [];
      for (const m of modules) {
        if (m.courseId !== course.id) continue;
        const hasAsg = m.assignments.length > 0;
        const hasQuiz = m.quizzes.length > 0;
        if (!hasAsg && !hasQuiz) continue;
        const total = a.total.get(m.id) ?? 0;
        const earned = a.earned.get(m.id) ?? 0;
        const asgPct = total === 0 ? 0 : (earned / total) * 100;
        const qSum = quizSum.get(`${course.id}|${peer.userId}|${m.id}`) ?? 0;
        const quizPct = hasQuiz ? qSum / m.quizzes.length : 0;
        // Each week is rounded before averaging, exactly as lib/scores does,
        // so the leaderboard and the Scores page cannot disagree by a point.
        weeks.push(Math.round(blend(asgPct, quizPct, hasAsg, hasQuiz)));
      }
      if (weeks.length === 0) continue;
      rows.push({
        userId: peer.userId,
        name: displayName(peer.user.profile, peer.user.email),
        percent: Math.round(weeks.reduce((x, y) => x + y, 0) / weeks.length),
        weeksScored: weeks.length,
        isMe: peer.userId === userId,
      });
    }

    rows.sort((x, y) => y.percent - x.percent || x.name.localeCompare(y.name));
    const myIndex = rows.findIndex((r) => r.isMe);

    return {
      courseId: course.id,
      courseName: course.name,
      courseSlug: course.slug,
      rank: myIndex === -1 ? null : myIndex + 1,
      rankedStudents: rows.length,
      myPercent: myIndex === -1 ? 0 : rows[myIndex].percent,
      around: myIndex === -1 ? [] : rows.slice(Math.max(0, myIndex - WINDOW), myIndex + WINDOW + 1),
    };
  });

  return standings.sort((a, b) => a.courseName.localeCompare(b.courseName));
}
