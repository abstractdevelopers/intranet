"use client";

import { QuizRunner, type QuizRunnerQuestion } from "./quiz-runner";

/**
 * Intranet 101 — the compulsory academy-wide intro assessment.
 *
 * Thin wrapper over the shared runner so its page and copy are unchanged.
 */
export function Intranet101Quiz({
  title,
  description,
  passMark,
  maxAttempts,
  attemptsUsed,
  attemptsLeft,
  passed,
  questions,
  initialScore,
}: {
  title: string;
  description: string | null;
  passMark: number;
  maxAttempts: number;
  attemptsUsed: number;
  attemptsLeft: number;
  passed: boolean;
  questions: QuizRunnerQuestion[];
  initialScore: number | null;
}) {
  return (
    <QuizRunner
      eyebrow="Intranet 101"
      title={title}
      description={description}
      passMark={passMark}
      maxAttempts={maxAttempts}
      attemptsUsed={attemptsUsed}
      attemptsLeft={attemptsLeft}
      passed={passed}
      questions={questions}
      initialScore={initialScore}
      submitUrl="/api/student/intranet-101"
      passedNote="You've completed Intranet 101. You can revisit this page any time."
      outOfAttemptsNote="You've used both attempts. Reach out to the academy team and they'll help you get this sorted."
      retryNote="Have another look at the video, then take your final attempt."
      backHref="/student"
      backLabel="Back to dashboard"
    />
  );
}
