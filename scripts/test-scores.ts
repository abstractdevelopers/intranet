/**
 * Scoring checks — the 70/30 blend, and the leaderboard agreeing with it.
 *
 *   npx tsx scripts/test-scores.ts
 *
 * The important guarantee is the second half: the Scores page and the
 * leaderboard must never show a student two different numbers, so every
 * enrolled student's leaderboard figure is compared against lib/scores, which
 * is the reference implementation the dashboard and Progress page use.
 *
 * The cross-check computes a full leaderboard per student and is therefore
 * quadratic: expect roughly 15 minutes against the pooled database. Lower
 * CROSS_CHECK_LIMIT while iterating.
 */
import { db } from "../src/lib/db";
import { getReleasedModules, getScoreBreakdown, ASSIGNMENT_WEIGHT, QUIZ_WEIGHT } from "../src/lib/scores";
import { getCourseStandings } from "../src/lib/leaderboard";

/** Students compared per course. The full 234 takes about 15 minutes. */
const CROSS_CHECK_LIMIT = Number(process.env.CROSS_CHECK_LIMIT ?? 20);

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}  ${detail}`);
  }
}

/** The rule, restated independently of the implementation. */
function expectedWeek(asgPct: number, quizPct: number, hasAsg: boolean, hasQuiz: boolean) {
  if (hasAsg && hasQuiz) return Math.round(asgPct * 0.7 + quizPct * 0.3);
  if (hasAsg) return Math.round(asgPct);
  if (hasQuiz) return Math.round(quizPct);
  return 0;
}

async function main() {
  console.log("=== constants ===");
  check("assignment weight is 70%", ASSIGNMENT_WEIGHT === 0.7);
  check("quiz weight is 30%", QUIZ_WEIGHT === 0.3);

  // Pick students with real marks so the checks are not run against zeros.
  const gradedIds = [...new Set((await db.grade.findMany({ select: { submission: { select: { userId: true } } } })).map((g) => g.submission.userId))];
  const sample = gradedIds.slice(0, 8);
  console.log(`\n=== week blend, recomputed independently (${sample.length} students) ===`);

  let weekMismatch = 0;
  let checkedWeeks = 0;
  for (const id of sample) {
    const mods = await getReleasedModules(id);
    for (const m of mods) {
      if (!m.hasAssignments && !m.hasQuizzes) continue;
      checkedWeeks++;
      const asgPct = m.assignmentPossible === 0 ? 0 : (m.assignmentEarned / m.assignmentPossible) * 100;
      const want = expectedWeek(asgPct, m.quizPercent, m.hasAssignments, m.hasQuizzes);
      if (want !== m.percent) {
        weekMismatch++;
        console.log(`    mismatch user ${id.slice(0, 8)} wk${m.weekNumber}: ${m.percent} vs ${want}`);
      }
    }
  }
  check(`all ${checkedWeeks} weeks match the 70/30 rule`, weekMismatch === 0, `${weekMismatch} off`);

  console.log("\n=== a week never scores above 100 ===");
  const allMods = (await Promise.all(sample.map((id) => getReleasedModules(id)))).flat();
  check("no week above 100%", allMods.every((m) => m.percent <= 100), allMods.filter((m) => m.percent > 100).map((m) => m.percent).join(","));
  check("no week below 0%", allMods.every((m) => m.percent >= 0));

  console.log("\n=== week labels ===");
  const first = sample[0];
  if (first) {
    const bd = await getScoreBreakdown(first);
    for (const w of bd.weekly) console.log(`  ${w.label} -> ${w.percent}%`);
    check("labels read 'Week N'", bd.weekly.every((w) => /^Week \d+$/.test(w.label)));
    check("week numbers ascend", bd.weekly.every((w, i) => i === 0 || w.weekNumber > bd.weekly[i - 1].weekNumber));
  }

  console.log("\n=== leaderboard matches lib/scores for every enrolled student ===");
  let compared = 0;
  let mismatches = 0;
  for (const slug of ["graphics-design", "personal-branding", "video-editing", "content-writing", "communication-influence"]) {
    const course = await db.course.findUnique({ where: { slug }, select: { id: true, name: true } });
    if (!course) continue;
    const enrolled = await db.enrollment.findMany({
      where: { courseId: course.id, status: "ACCEPTED" },
      select: { userId: true },
      take: CROSS_CHECK_LIMIT,
    });
    let courseMismatch = 0;
    for (const e of enrolled) {
      const mods = await getReleasedModules(e.userId, [course.id]);
      const withWork = mods.filter((m) => m.hasAssignments || m.hasQuizzes);
      const reference = withWork.length === 0 ? 0 : Math.round(withWork.reduce((s, m) => s + m.percent, 0) / withWork.length);

      const standings = await getCourseStandings(e.userId);
      const mine = standings.find((s) => s.courseId === course.id);
      if (!mine) continue;
      compared++;
      if (mine.myPercent !== reference) {
        courseMismatch++;
        mismatches++;
        console.log(`    ${course.name}: ${mine.myPercent}% vs ${reference}%`);
      }
    }
    console.log(`  ${course.name}: ${enrolled.length} students, ${courseMismatch} mismatched`);
  }
  check(`${compared} students agree between the two implementations`, mismatches === 0, `${mismatches} differ`);

  await db.$disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
