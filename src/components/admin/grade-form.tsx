"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Textarea, Field } from "@/components/ui/input";

type WrittenQuestion = { id: string; prompt: string; points: number; answer: string };

/**
 * Marking form.
 *
 * A theory paper collects a mark per written question (MCQ questions are
 * already auto-scored and are not shown here). A practical paper collects a
 * single score out of its max. The final percentage is computed on the server.
 */
export function GradeForm({
  assessmentId,
  submissionId,
  kind,
  maxScore,
  writtenQuestions,
  initialMarks,
  initialScore,
  initialFeedback,
}: {
  assessmentId: string;
  submissionId: string;
  kind: "THEORY" | "PRACTICAL";
  maxScore: number;
  writtenQuestions?: WrittenQuestion[];
  initialMarks?: Record<string, number>;
  initialScore?: number | null;
  initialFeedback?: string | null;
}) {
  const router = useRouter();
  const [marks, setMarks] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const q of writtenQuestions ?? []) {
      v[q.id] = initialMarks?.[q.id] !== undefined ? String(initialMarks[q.id]) : "";
    }
    return v;
  });
  const [score, setScore] = useState(initialScore !== null && initialScore !== undefined ? String(initialScore) : "");
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const totalWritten = (writtenQuestions ?? []).reduce((s, q) => s + q.points, 0);
  const allMarked = (writtenQuestions ?? []).every((q) => marks[q.id] !== "" && marks[q.id] !== undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const body =
      kind === "THEORY"
        ? {
            marks: Object.fromEntries(
              Object.entries(marks).map(([k, v]) => [k, Number(v) || 0]),
            ),
            feedback: feedback || null,
          }
        : { score: Number(score) || 0, feedback: feedback || null };

    const res = await fetch(
      `/api/admin/assessments/${assessmentId}/submissions/${submissionId}/grade`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't save that mark.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {kind === "THEORY" ? (
        <div className="space-y-3">
          {(writtenQuestions ?? []).length === 0 ? (
            <p className="text-sm text-text-muted">
              This paper has no written answers — it was graded automatically on submission.
            </p>
          ) : (
            (writtenQuestions ?? []).map((q) => (
              <div key={q.id} className="rounded-lg border border-border bg-surface-2 p-4">
                <p className="text-sm font-medium">{q.prompt}</p>
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-surface p-3 text-sm text-text">
                  {q.answer || <span className="text-text-muted">No answer given.</span>}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <label htmlFor={`mark-${q.id}`} className="text-xs font-semibold text-text-muted">
                    Marks
                  </label>
                  <Input
                    id={`mark-${q.id}`}
                    type="number"
                    min={0}
                    max={q.points}
                    value={marks[q.id] ?? ""}
                    onChange={(e) => {
                      setMarks((prev) => ({ ...prev, [q.id]: e.target.value }));
                      setSaved(false);
                    }}
                    className="w-24"
                  />
                  <span className="text-sm text-text-muted">/ {q.points}</span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <Field label="Score" htmlFor="practical-score">
          <div className="flex items-center gap-2">
            <Input
              id="practical-score"
              type="number"
              min={0}
              max={maxScore}
              value={score}
              onChange={(e) => {
                setScore(e.target.value);
                setSaved(false);
              }}
              className="w-28"
            />
            <span className="text-sm text-text-muted">/ {maxScore}</span>
          </div>
        </Field>
      )}

      <Field label="Feedback (optional)" htmlFor="grade-feedback">
        <Textarea
          id="grade-feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
          placeholder="Comments for the student…"
        />
      </Field>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {saved ? <p className="text-sm font-semibold text-success">Mark saved.</p> : null}

      <button
        type="submit"
        disabled={busy || (kind === "THEORY" ? totalWritten > 0 && !allMarked : score === "")}
        className="rounded-lg bg-brand-1 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save mark"}
      </button>
    </form>
  );
}
