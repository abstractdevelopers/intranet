"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Textarea, Field } from "@/components/ui/input";
import { IconClose, IconCheck } from "@/components/icons";

type Option = { label: string; isCorrect: boolean };
type Question = {
  kind: "MCQ" | "TEXT";
  prompt: string;
  explanation: string;
  points: number;
  options: Option[];
};

const blankMcq = (): Question => ({
  kind: "MCQ",
  prompt: "",
  explanation: "",
  points: 1,
  options: [
    { label: "", isCorrect: true },
    { label: "", isCorrect: false },
  ],
});

const blankText = (): Question => ({
  kind: "TEXT",
  prompt: "",
  explanation: "",
  points: 1,
  options: [],
});

/**
 * Question builder for a theory paper.
 *
 * Posts the whole list on save, replacing what is stored — the same
 * replace-wholesale pattern the Intranet 101 seed uses, so this editor is the
 * single source of truth. An MCQ is validated to have exactly one correct
 * option on the server too.
 */
export function QuestionEditor({
  assessmentId,
  initial,
}: {
  assessmentId: string;
  initial: { id: string; kind: string; prompt: string; explanation: string | null; points: number; options: { label: string; isCorrect: boolean }[] }[];
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>(
    initial.length > 0
      ? initial.map((q) => ({
          kind: q.kind as "MCQ" | "TEXT",
          prompt: q.prompt,
          explanation: q.explanation ?? "",
          points: q.points,
          options: q.options.map((o) => ({ label: o.label, isCorrect: o.isCorrect })),
        }))
      : [blankMcq()],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update(index: number, patch: Partial<Question>) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
    setSaved(false);
  }

  function setOption(qi: number, oi: number, patch: Partial<Option>) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qi) return q;
        const options = q.options.map((o, j) => {
          // Selecting a correct answer clears the others — exactly one is right.
          if (patch.isCorrect && j !== oi) return { ...o, isCorrect: false };
          return j === oi ? { ...o, ...patch } : o;
        });
        return { ...q, options };
      }),
    );
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const payload = questions.map((q) => ({
      kind: q.kind,
      prompt: q.prompt,
      explanation: q.explanation || null,
      points: q.points,
      options: q.kind === "MCQ" ? q.options.filter((o) => o.label.trim()) : [],
    }));
    const res = await fetch(`/api/admin/assessments/${assessmentId}/questions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions: payload }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't save the questions.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {questions.map((q, qi) => (
        <div key={qi} className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Question {qi + 1}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  update(qi, q.kind === "MCQ" ? blankText() : blankMcq())
                }
                className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-text-muted"
              >
                {q.kind === "MCQ" ? "Switch to written" : "Switch to multiple choice"}
              </button>
              <button
                type="button"
                onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qi))}
                aria-label={`Remove question ${qi + 1}`}
                className="rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 dark:border-red-800 dark:text-red-400"
              >
                <IconClose className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            <Field label="Prompt" htmlFor={`q-${qi}-prompt`}>
              <Textarea
                id={`q-${qi}-prompt`}
                value={q.prompt}
                onChange={(e) => update(qi, { prompt: e.target.value })}
                rows={2}
              />
            </Field>

            {q.kind === "MCQ" ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-text-muted">
                  Options — tick the single correct answer
                </p>
                {q.options.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOption(qi, oi, { isCorrect: true })}
                      aria-label={`Mark option ${oi + 1} correct`}
                      className={[
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                        o.isCorrect ? "border-success bg-success text-white" : "border-border text-transparent",
                      ].join(" ")}
                    >
                      <IconCheck className="h-3.5 w-3.5" />
                    </button>
                    <Input
                      value={o.label}
                      onChange={(e) => setOption(qi, oi, { label: e.target.value })}
                      placeholder={`Option ${oi + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        update(qi, { options: q.options.filter((_, j) => j !== oi) })
                      }
                      aria-label={`Remove option ${oi + 1}`}
                      className="text-text-muted hover:text-danger"
                    >
                      <IconClose className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    update(qi, { options: [...q.options, { label: "", isCorrect: false }] })
                  }
                  className="text-xs font-semibold text-brand-1 dark:text-brand-3"
                >
                  + Add option
                </button>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Marks" htmlFor={`q-${qi}-points`}>
                <Input
                  id={`q-${qi}-points`}
                  type="number"
                  min={1}
                  value={q.points}
                  onChange={(e) => update(qi, { points: Number(e.target.value) || 1 })}
                />
              </Field>
              <Field label="Marker note (optional)" htmlFor={`q-${qi}-explanation`}>
                <Input
                  id={`q-${qi}-explanation`}
                  value={q.explanation}
                  onChange={(e) => update(qi, { explanation: e.target.value })}
                  placeholder="Shown only to staff"
                />
              </Field>
            </div>
          </div>
        </div>
      ))}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {saved ? <p className="text-sm font-semibold text-success">Questions saved.</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setQuestions((prev) => [...prev, blankMcq()])}
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-muted"
        >
          + Add multiple choice
        </button>
        <button
          type="button"
          onClick={() => setQuestions((prev) => [...prev, blankText()])}
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-muted"
        >
          + Add written
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-brand-1 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save questions"}
        </button>
      </div>
    </div>
  );
}
