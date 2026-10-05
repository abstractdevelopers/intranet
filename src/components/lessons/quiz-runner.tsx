"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconCheck, IconCheckCircle, IconClose, IconTarget, IconAnnouncement } from "@/components/icons";

export type QuizRunnerQuestion = {
  id: string;
  prompt: string;
  order: number;
  options: { id: string; label: string; order: number }[];
};

type Result = {
  score: number;
  passed: boolean;
  correct: Record<string, boolean>;
  attemptsLeft: number;
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/**
 * Shared quiz runner for every assessment — Intranet 101 and the weekly quizzes.
 *
 * Answers are graded server-side; this component never learns which option was
 * right until the submission comes back, so the answers can't be read from the
 * page. The attempt limit is also enforced by the API, not here — the UI only
 * reflects it.
 *
 * `submitUrl` is the only thing that differs per quiz, which keeps the
 * answer-hiding and attempt display in one place.
 */
export function QuizRunner({
  eyebrow,
  title,
  description,
  passMark,
  maxAttempts,
  attemptsUsed,
  attemptsLeft,
  passed,
  questions,
  initialScore,
  submitUrl,
  passedNote,
  outOfAttemptsNote,
  retryNote,
  backHref,
  backLabel,
}: {
  eyebrow: string;
  title: string;
  description: string | null;
  passMark: number;
  maxAttempts: number;
  attemptsUsed: number;
  attemptsLeft: number;
  passed: boolean;
  questions: QuizRunnerQuestion[];
  initialScore: number | null;
  submitUrl: string;
  passedNote: string;
  outOfAttemptsNote: string;
  retryNote: string;
  backHref: string;
  backLabel: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;
  const finished = passed || (result !== null && result.attemptsLeft === 0 && !result.passed);
  const canAnswer = !passed && (result === null || !result.passed) && !finished;

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(submitUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not submit your answers.");
      return;
    }
    setResult(data as Result);
    router.refresh();
  }

  function retry() {
    setAnswers({});
    setResult(null);
    setError(null);
  }

  const showReview = result !== null;

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="mt-2 text-sm text-text-muted">{description}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <IconTarget className="h-3.5 w-3.5" /> {passMark}% to pass
          </span>
          <span>·</span>
          <span>
            Attempt {Math.min(attemptsUsed + (showReview ? 0 : 1), maxAttempts)} of {maxAttempts}
          </span>
          {attemptsLeft > 0 && !passed ? (
            <>
              <span>·</span>
              <span>{attemptsLeft} left</span>
            </>
          ) : null}
        </div>
      </header>

      {passed ? (
        <div className="rounded-xl border border-success/30 bg-success/10 p-5">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-success">
            <IconCheckCircle className="h-5 w-5" /> Passed
            {initialScore !== null ? ` — ${initialScore}%` : ""}
          </p>
          <p className="mt-1 text-sm text-text-muted">{passedNote}</p>
        </div>
      ) : null}

      {finished && !passed ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-5">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-danger">
            <IconClose className="h-5 w-5" /> No attempts remaining
          </p>
          <p className="mt-1 text-sm text-text-muted">{outOfAttemptsNote}</p>
        </div>
      ) : null}

      {result && !result.passed && result.attemptsLeft > 0 ? (
        <div className="rounded-xl border border-brand-1/30 bg-brand-3/15 p-5">
          <p className="text-sm font-semibold">
            {result.score}% — you need {passMark}% to pass.
          </p>
          <p className="mt-1 text-sm text-text-muted">{retryNote}</p>
          <button
            onClick={retry}
            className="mt-3 rounded-lg bg-brand-1 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Try again
          </button>
        </div>
      ) : null}

      <ol className="space-y-5">
        {questions.map((q, qi) => {
          const chosen = answers[q.id];
          const wasCorrect = result?.correct?.[q.id];
          return (
            <li key={q.id} className="rounded-xl border border-border bg-surface p-5">
              <p className="text-sm font-semibold leading-6">
                {qi + 1}. {q.prompt}
              </p>
              <div className="mt-3 space-y-2">
                {q.options.map((opt, oi) => {
                  const selected = chosen === opt.id;
                  const isRight = showReview && wasCorrect && selected;
                  const isWrong = showReview && selected && !wasCorrect;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!canAnswer}
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                      aria-pressed={selected}
                      className={[
                        "flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                        isRight
                          ? "border-success/50 bg-success/10"
                          : isWrong
                            ? "border-danger/50 bg-danger/10"
                            : selected
                              ? "border-brand-1 bg-brand-3/20"
                              : "border-border bg-surface hover:border-brand-1/40",
                        canAnswer ? "cursor-pointer" : "cursor-default",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                          isRight
                            ? "border-success bg-success text-white"
                            : isWrong
                              ? "border-danger bg-danger text-white"
                              : selected
                                ? "border-brand-1 bg-brand-1 text-white"
                                : "border-border text-text-muted",
                        ].join(" ")}
                      >
                        {isRight ? (
                          <IconCheck className="h-3.5 w-3.5" />
                        ) : isWrong ? (
                          <IconClose className="h-3.5 w-3.5" />
                        ) : (
                          LETTERS[oi]
                        )}
                      </span>
                      <span className="flex-1 leading-6">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              {showReview && !wasCorrect ? (
                <p className="mt-3 text-xs text-text-muted">
                  {result?.correct?.[q.id] === false
                    ? "Not quite — the correct answer is highlighted above."
                    : ""}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {error ? (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {canAnswer ? (
        <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
          <span className="inline-flex items-center gap-2 text-sm text-text-muted">
            <IconAnnouncement className="h-4 w-4" />
            {answeredCount} of {questions.length} answered
          </span>
          <button
            onClick={submit}
            disabled={!allAnswered || submitting}
            className="rounded-lg bg-brand-1 px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {submitting ? "Submitting…" : "Finish"}
          </button>
        </div>
      ) : null}

      <div className="border-t border-border pt-5">
        <Link href={backHref} className="text-sm font-semibold text-brand-1 hover:underline">
          ← {backLabel}
        </Link>
      </div>
    </div>
  );
}
