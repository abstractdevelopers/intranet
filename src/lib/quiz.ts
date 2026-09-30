import { db } from "./db";
import { INTRANET_101_SLUG } from "./intranet-101";

/**
 * Intranet 101 — the compulsory academy-wide intro assessment.
 *
 * Grading happens here, on the server. `QuizOption.isCorrect` is never included
 * in anything sent to the client, so the answers cannot be read from the page
 * source, and the attempt limit is checked before a submission is recorded —
 * not in the UI.
 */

export type QuizQuestionView = {
  id: string;
  prompt: string;
  order: number;
  options: { id: string; label: string; order: number }[];
};

export type Intranet101View = {
  id: string;
  title: string;
  description: string | null;
  passMark: number;
  maxAttempts: number;
  attemptsUsed: number;
  attemptsLeft: number;
  passed: boolean;
  canAttempt: boolean;
  questions: QuizQuestionView[];
  /** Result of the most recent attempt, so a finished quiz can show its score. */
  lastAttempt: { score: number; passed: boolean; submittedAt: Date } | null;
};

/** The quiz, with correct answers stripped, plus this student's attempt state. */
export async function getIntranet101(userId: string): Promise<Intranet101View | null> {
  const quiz = await db.quiz.findUnique({
    where: { slug: INTRANET_101_SLUG },
    include: {
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          prompt: true,
          order: true,
          options: {
            orderBy: { order: "asc" },
            // Deliberately no isCorrect — this shape reaches the browser.
            select: { id: true, label: true, order: true },
          },
        },
      },
      attempts: {
        where: { userId },
        orderBy: { submittedAt: "desc" },
        select: { score: true, passed: true, submittedAt: true },
      },
    },
  });
  if (!quiz || quiz.status !== "PUBLISHED") return null;

  const attemptsUsed = quiz.attempts.length;
  const passed = quiz.attempts.some((a) => a.passed);
  const attemptsLeft = Math.max(0, quiz.maxAttempts - attemptsUsed);

  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    passMark: quiz.passMark,
    maxAttempts: quiz.maxAttempts,
    attemptsUsed,
    attemptsLeft,
    passed,
    // Once passed, or once attempts run out, there is nothing left to submit.
    canAttempt: !passed && attemptsLeft > 0,
    questions: quiz.questions,
    lastAttempt: quiz.attempts[0] ?? null,
  };
}

export type SubmitResult =
  | { ok: true; score: number; passed: boolean; correct: Record<string, boolean>; attemptsLeft: number }
  | { ok: false; error: string; status: number };

/**
 * Grade a submission and record it.
 *
 * `answers` maps question id -> chosen option id. Anything missing counts as
 * wrong rather than being skipped, so a partial submission cannot inflate the
 * score.
 */
export async function submitIntranet101(
  userId: string,
  answers: Record<string, string>
): Promise<SubmitResult> {
  const quiz = await db.quiz.findUnique({
    where: { slug: INTRANET_101_SLUG },
    include: { questions: { include: { options: true } } },
  });
  if (!quiz || quiz.status !== "PUBLISHED") {
    return { ok: false, error: "Assessment not available.", status: 404 };
  }

  const attemptsUsed = await db.quizAttempt.count({ where: { userId, quizId: quiz.id } });
  const alreadyPassed = await db.quizAttempt.count({
    where: { userId, quizId: quiz.id, passed: true },
  });
  if (alreadyPassed > 0) {
    return { ok: false, error: "You've already passed this assessment.", status: 409 };
  }
  if (attemptsUsed >= quiz.maxAttempts) {
    return { ok: false, error: "No attempts remaining.", status: 429 };
  }

  const correct: Record<string, boolean> = {};
  let right = 0;
  for (const question of quiz.questions) {
    const chosen = answers[question.id];
    const correctOption = question.options.find((o) => o.isCorrect);
    const isRight = Boolean(chosen) && chosen === correctOption?.id;
    correct[question.id] = isRight;
    if (isRight) right++;
  }

  const score = quiz.questions.length
    ? Math.round((right / quiz.questions.length) * 100)
    : 0;
  const passed = score >= quiz.passMark;

  await db.$transaction(async (tx) => {
    await tx.quizAttempt.create({
      data: { userId, quizId: quiz.id, score, passed, answers },
    });
    // Stamp the student so the rest of the portal can gate on it.
    if (passed) {
      await tx.user.update({
        where: { id: userId },
        data: { intranet101PassedAt: new Date() },
      });
    }
  });

  return {
    ok: true,
    score,
    passed,
    correct,
    attemptsLeft: Math.max(0, quiz.maxAttempts - attemptsUsed - 1),
  };
}

/** Whether this student still owes the intro assessment. */
export async function needsIntranet101(userId: string): Promise<boolean> {
  const quiz = await db.quiz.findUnique({
    where: { slug: INTRANET_101_SLUG },
    select: { id: true, isRequired: true, status: true },
  });
  if (!quiz || quiz.status !== "PUBLISHED" || !quiz.isRequired) return false;

  const passed = await db.quizAttempt.count({
    where: { userId, quizId: quiz.id, passed: true },
  });
  return passed === 0;
}
