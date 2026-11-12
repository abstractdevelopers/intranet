import { db } from "./db";
import { getOverallScore } from "./scores";
import { DEFAULT_ASSESSMENT_WEIGHTS, resultBand, type ResultBand } from "./constants";

/**
 * Final academic score.
 *
 * The overall figure is a single percentage between 0 and 100, blended from
 * three components:
 *
 *   overall = (assignment% × assignmentWeight
 *              + theory%     × theoryWeight
 *              + practical%  × practicalWeight) / (sum of weights in scope)
 *
 * The weights always sum to 100, and the division re-normalises over the
 * components that are actually in scope — so the result can never exceed 100%
 * no matter how many assignments or assessments a student completes.
 *
 * "In scope" is deliberate:
 *   - a component whose paper/module exists for the student counts, and a
 *     missing submission counts as 0 (missing work is zero, as in scores.ts) —
 *     so skipping a paper cannot inflate the average;
 *   - a component that isn't part of the programme at all (no published paper,
 *     no released assignments) is left out and its weight redistributed, so a
 *     student is never penalised for work they were never given.
 */

export type ResultComponents = {
  assignmentPercent: number | null;
  theoryPercent: number | null;
  practicalPercent: number | null;
};

export type ResultWeights = {
  assignment: number;
  theory: number;
  practical: number;
};

export type CollatedResult = ResultComponents & {
  overallPercent: number;
  band: ResultBand;
  /** Which components were blended, and at what effective weight. */
  effectiveWeights: ResultWeights;
  /** True when at least one component has no score yet. */
  incomplete: boolean;
};

/** Read the academy's grading weights, falling back to the defaults. */
export async function getWeights(): Promise<ResultWeights> {
  const config = await db.assessmentConfig.findUnique({ where: { id: "global" } });
  if (!config) return { ...DEFAULT_ASSESSMENT_WEIGHTS };
  const total = config.assignmentWeight + config.theoryWeight + config.practicalWeight;
  if (total <= 0) return { ...DEFAULT_ASSESSMENT_WEIGHTS };
  return {
    assignment: config.assignmentWeight,
    theory: config.theoryWeight,
    practical: config.practicalWeight,
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/**
 * Blend components into a single 0-100 figure.
 *
 * `present` marks which components are in scope. A component in scope but null
 * (nothing submitted) contributes 0; one not in scope is dropped entirely and
 * its weight redistributed.
 */
export function blend(
  components: ResultComponents,
  weights: ResultWeights,
  present: { assignment: boolean; theory: boolean; practical: boolean }
): { overallPercent: number; effectiveWeights: ResultWeights; incomplete: boolean } {
  const entries: { key: keyof ResultWeights; weight: number; value: number | null }[] = [
    { key: "assignment", weight: weights.assignment, value: components.assignmentPercent },
    { key: "theory", weight: weights.theory, value: components.theoryPercent },
    { key: "practical", weight: weights.practical, value: components.practicalPercent },
  ];

  let weightedSum = 0;
  let weightTotal = 0;
  let incomplete = false;
  const effectiveWeights: ResultWeights = { assignment: 0, theory: 0, practical: 0 };

  for (const e of entries) {
    if (!present[e.key]) continue; // not part of the programme — drop it
    if (e.value === null) incomplete = true; // in scope but unmarked — counts as 0
    weightTotal += e.weight;
    weightedSum += (e.value ?? 0) * e.weight;
    effectiveWeights[e.key] = e.weight;
  }

  // No component in scope at all: report 0 rather than dividing by zero.
  const overallPercent = weightTotal === 0 ? 0 : round1(weightedSum / weightTotal);
  // Clamp defensively — the maths can't exceed 100, but a bad config shouldn't
  // ever surface an inflated figure.
  return {
    overallPercent: Math.max(0, Math.min(100, overallPercent)),
    effectiveWeights,
    incomplete,
  };
}

/** Whether a published paper of `kind` exists for this student's pathway. */
async function paperInScope(userId: string, kind: "THEORY" | "PRACTICAL") {
  const pathway = await db.enrollment.findFirst({
    where: { userId, enrollmentType: "ELECTIVE", status: "ACCEPTED" },
    select: { pathway: true, course: { select: { pathway: true } } },
  });
  const studentPathway = pathway?.pathway ?? pathway?.course.pathway ?? null;
  const count = await db.assessment.count({
    where: { kind, status: "PUBLISHED", OR: [{ pathway: studentPathway }, { pathway: null }] },
  });
  return count > 0;
}

/** Whether the student has any released module carrying gradable work. */
async function assignmentsInScope(userId: string) {
  const count = await db.enrollment.count({ where: { userId, status: "ACCEPTED" } });
  return count > 0;
}

/**
 * Collate one student's components into a final result.
 *
 * Components:
 *   assignmentPercent — the weekly-averaged score already used on /student/scores
 *   theoryPercent     — their theory paper, 0-100
 *   practicalPercent  — their practical paper, 0-100
 */
export async function computeResult(userId: string, weights?: ResultWeights): Promise<CollatedResult> {
  const w = weights ?? (await getWeights());

  const [assignmentSummary, theorySub, practicalSub, hasTheory, hasPractical, hasAssignments] =
    await Promise.all([
      getOverallScore(userId),
      db.assessmentSubmission.findFirst({
        where: { userId, assessment: { kind: "THEORY" } },
        select: { score: true },
        orderBy: { submittedAt: "desc" },
      }),
      db.assessmentSubmission.findFirst({
        where: { userId, assessment: { kind: "PRACTICAL" } },
        select: { score: true },
        orderBy: { submittedAt: "desc" },
      }),
      paperInScope(userId, "THEORY"),
      paperInScope(userId, "PRACTICAL"),
      assignmentsInScope(userId),
    ]);

  const components: ResultComponents = {
    assignmentPercent: assignmentSummary.hasScores ? assignmentSummary.percent : null,
    theoryPercent: theorySub?.score ?? null,
    practicalPercent: practicalSub?.score ?? null,
  };

  const { overallPercent, effectiveWeights, incomplete } = blend(components, w, {
    assignment: hasAssignments,
    theory: hasTheory,
    practical: hasPractical,
  });

  return {
    ...components,
    overallPercent,
    band: resultBand(overallPercent),
    effectiveWeights,
    incomplete,
  };
}

/**
 * Recompute and persist every student's result.
 *
 * Idempotent. Existing rows keep their `released` flag and email record, so a
 * recompute never un-releases a result or re-sends a report. Returns the number
 * of students processed.
 */
export async function computeAllResults(): Promise<number> {
  const weights = await getWeights();
  const students = await db.user.findMany({
    where: { role: "STUDENT", status: "ACTIVE" },
    select: { id: true },
  });

  let count = 0;
  for (const student of students) {
    const result = await computeResult(student.id, weights);
    await db.studentResult.upsert({
      where: { userId: student.id },
      create: {
        userId: student.id,
        assignmentPercent: result.assignmentPercent,
        theoryPercent: result.theoryPercent,
        practicalPercent: result.practicalPercent,
        overallPercent: result.overallPercent,
        band: result.band,
        computedAt: new Date(),
      },
      update: {
        assignmentPercent: result.assignmentPercent,
        theoryPercent: result.theoryPercent,
        practicalPercent: result.practicalPercent,
        overallPercent: result.overallPercent,
        band: result.band,
        computedAt: new Date(),
      },
    });
    count += 1;
  }
  return count;
}

/** The released result for a student, or null while it is still hidden. */
export async function getReleasedResult(userId: string) {
  return db.studentResult.findFirst({ where: { userId, released: true } });
}
