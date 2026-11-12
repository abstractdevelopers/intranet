"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AssessmentQuestionView, AssessmentView } from "@/lib/assessments";
import { Textarea } from "@/components/ui/input";
import { IconCheck, IconCheckCircle, IconAnnouncement, IconClock } from "@/components/icons";

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const DRAFT_PREFIX = "uca-assessment-draft:";

/**
 * Theory paper runner.
 *
 * MCQ answers are graded on the server; written answers are marked by staff
 * afterwards. Correct answers are never sent to the browser, so this component
 * cannot reveal them. Answers are cached in localStorage as the student works,
 * so a lost connection or an accidental refresh never costs them their paper.
 */
export function TheoryRunner({
  assessment,
  studentId,
}: {
  assessment: AssessmentView;
  studentId: string;
}) {
  const router = useRouter();
  const storageKey = `${DRAFT_PREFIX}${studentId}:${assessment.id}`;
  const existing = assessment.submission?.answers ?? {};

  const [answers, setAnswers] = useState<Record<string, string>>(existing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Restore a local draft only if the server has no answers yet, so a submitted
  // paper is never overwritten by stale local text.
  useEffect(() => {
    if (Object.keys(existing).length > 0) return;
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) setAnswers(JSON.parse(raw));
      } catch {
        /* ignore corrupt drafts */
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave locally as they type.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(answers));
    } catch {
      /* storage full or unavailable — autosave is best-effort */
    }
  }, [answers, storageKey]);

  const written = assessment.questions.filter((q) => q.kind === "TEXT");
  const answeredCount = assessment.questions.filter((q) => (answers[q.id] ?? "").trim()).length;
  const allAnswered = answeredCount === assessment.questions.length;

  const closed = assessment.window.closed;
  const upcoming = assessment.window.upcoming;
  const graded = assessment.submission?.status === "GRADED";

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/student/assessments/${assessment.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "We couldn't save your answers.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">{assessment.kind === "THEORY" ? "Theory assessment" : "Practical assessment"}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{assessment.title}</h1>
        {assessment.description ? (
          <p className="mt-2 text-sm text-text-muted">{assessment.description}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <IconClock className="h-3.5 w-3.5" /> Closes{" "}
            {assessment.window.closesAt.toLocaleString("en-NG", {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span>·</span>
          <span>{assessment.totalPoints} marks</span>
          {written.length > 0 ? (
            <>
              <span>·</span>
              <span>{written.length} written answer{written.length === 1 ? "" : "s"} marked by your facilitator</span>
            </>
          ) : null}
        </div>
      </header>

      {assessment.instructions ? (
        <div className="rounded-xl border border-border bg-surface-2 p-5 text-sm leading-7 text-text">
          <p className="eyebrow mb-2">Instructions</p>
          <p className="whitespace-pre-wrap">{assessment.instructions}</p>
        </div>
      ) : null}

      {upcoming ? (
        <div className="rounded-xl border border-brand-1/30 bg-brand-3/15 p-5">
          <p className="text-sm font-semibold">This assessment opens on Thursday 12 November at 10:00 WAT.</p>
          <p className="mt-1 text-sm text-text-muted">Come back then to begin.</p>
        </div>
      ) : null}

      {closed ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-5">
          <p className="text-sm font-semibold text-danger">The submission deadline has passed.</p>
          <p className="mt-1 text-sm text-text-muted">
            {assessment.submission
              ? "Your last submission was saved before the deadline."
              : "No submission was recorded for this paper."}
          </p>
        </div>
      ) : null}

      {graded ? (
        <div className="rounded-xl border border-success/30 bg-success/10 p-5">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-success">
            <IconCheckCircle className="h-5 w-5" /> Marked
            {assessment.submission?.score !== null && assessment.submission?.score !== undefined
              ? ` — ${Math.round(assessment.submission.score)}%`
              : ""}
          </p>
          {assessment.submission?.feedback ? (
            <p className="mt-1 text-sm text-text-muted">{assessment.submission.feedback}</p>
          ) : null}
        </div>
      ) : null}

      <ol className="space-y-5">
        {assessment.questions.map((q, qi) => (
          <QuestionBlock
            key={q.id}
            question={q}
            index={qi}
            value={answers[q.id] ?? ""}
            disabled={closed || upcoming}
            onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
          />
        ))}
      </ol>

      {error ? (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
      ) : null}

      {!closed && !upcoming ? (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface/95 py-4 backdrop-blur">
          <span className="inline-flex items-center gap-2 text-sm text-text-muted">
            <IconAnnouncement className="h-4 w-4" />
            {answeredCount} of {assessment.questions.length} answered
          </span>
          <div className="flex items-center gap-3">
            {saved ? <span className="text-xs font-semibold text-success">Saved</span> : null}
            <button
              onClick={submit}
              disabled={busy || !allAnswered}
              className="rounded-lg bg-brand-1 px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Saving…" : assessment.submission ? "Update submission" : "Submit assessment"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QuestionBlock({
  question,
  index,
  value,
  disabled,
  onChange,
}: {
  question: AssessmentQuestionView;
  index: number;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <li className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold leading-6">
          {index + 1}. {question.prompt}
        </p>
        <span className="shrink-0 text-xs text-text-muted">
          {question.points} {question.points === 1 ? "mark" : "marks"}
        </span>
      </div>

      {question.kind === "MCQ" ? (
        <div className="mt-3 space-y-2">
          {question.options.map((opt, oi) => {
            const selected = value === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange(opt.id)}
                aria-pressed={selected}
                className={[
                  "flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                  selected ? "border-brand-1 bg-brand-3/20" : "border-border bg-surface hover:border-brand-1/40",
                  disabled ? "cursor-default" : "cursor-pointer",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                    selected ? "border-brand-1 bg-brand-1 text-white" : "border-border text-text-muted",
                  ].join(" ")}
                >
                  {selected ? <IconCheck className="h-3.5 w-3.5" /> : LETTERS[oi]}
                </span>
                <span className="flex-1 leading-6">{opt.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <Textarea
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          placeholder="Type your answer…"
          className="mt-3"
        />
      )}
    </li>
  );
}
