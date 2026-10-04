/**
 * Late-submission policy.
 *
 * Three policies, all enforced server-side:
 *   ALLOW   - late submissions are accepted and marked normally.
 *   PENALTY - late submissions are accepted, flagged, and lose a fixed share of
 *             the maximum score when graded.
 *   BLOCK   - late submissions are refused outright.
 *
 * The deduction is applied at GRADING rather than at submission, because the
 * marker's score is what it applies to. Lateness is captured on the submission
 * at submit time (see AssignmentSubmission.late), since by grading time the
 * deadline has long passed and can no longer be compared.
 */

/** Share of the maximum score lost by a late submission under PENALTY. */
export const LATE_PENALTY_PERCENT = 20;

export type LatePolicy = "ALLOW" | "PENALTY" | "BLOCK";

export function isLate(submittedAt: Date, deadline: Date | null): boolean {
  return Boolean(deadline && submittedAt > deadline);
}

/**
 * Whether a submission is refused for being late. Only BLOCK refuses; the
 * student is told before they submit, and the API refuses regardless.
 */
export function isBlockedForLateness(deadline: Date | null, policy: string, now: Date = new Date()) {
  return Boolean(deadline && now > deadline && policy === "BLOCK");
}

/**
 * The score actually awarded for a graded submission.
 *
 * Under PENALTY a late submission loses LATE_PENALTY_PERCENT of the maximum,
 * so the deduction scales with the assignment rather than being a flat number
 * of points. Never drops below zero.
 */
export function awardedScore(input: {
  rawScore: number;
  maxScore: number;
  late: boolean;
  latePolicy: string;
}): { score: number; deducted: number } {
  if (!input.late || input.latePolicy !== "PENALTY") {
    return { score: input.rawScore, deducted: 0 };
  }
  const deduction = (input.maxScore * LATE_PENALTY_PERCENT) / 100;
  const score = Math.max(0, Math.round((input.rawScore - deduction) * 100) / 100);
  return { score, deducted: Math.round((input.rawScore - score) * 100) / 100 };
}

/** A passing grade after any deduction. Half the maximum, as elsewhere. */
export function isPassing(score: number, maxScore: number): boolean {
  return score >= maxScore * 0.5;
}
