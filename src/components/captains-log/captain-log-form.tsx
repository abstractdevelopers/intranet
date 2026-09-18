"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconCheck } from "@/components/icons";

type Question = { id: string; label: string; multiline: boolean };

/** The weekly Captain's Log form (#12). */
export function CaptainLogForm({
  weekNumber,
  questions,
  initial,
  alreadySubmitted,
}: {
  weekNumber: number;
  questions: Question[];
  initial: Record<string, string>;
  alreadySubmitted: boolean;
}) {
  const router = useRouter();
  const [responses, setResponses] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const q of questions) v[q.id] = initial[q.id] ?? "";
    return v;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(alreadySubmitted);

  function set(id: string, value: string) {
    setResponses((prev) => ({ ...prev, [id]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/student/captains-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekNumber, responses }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't save your Captain's Log. Please try again.");
      return;
    }
    setDone(true);
    router.refresh();
  }

  const inputClass =
    "mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand-1 focus:outline-2 focus:outline-brand-3";

  return (
    <form onSubmit={submit} className="space-y-5">
      {questions.map((q, i) => (
        <div key={q.id}>
          <label htmlFor={`cl-${q.id}`} className="block text-sm font-semibold">
            <span className="text-text-muted">{String(i + 1).padStart(2, "0")} — </span>
            {q.label}
          </label>
          {q.multiline ? (
            <textarea
              id={`cl-${q.id}`}
              rows={3}
              value={responses[q.id] ?? ""}
              onChange={(e) => set(q.id, e.target.value)}
              required
              className={inputClass}
            />
          ) : (
            <input
              id={`cl-${q.id}`}
              value={responses[q.id] ?? ""}
              onChange={(e) => set(q.id, e.target.value)}
              required
              className={inputClass}
            />
          )}
        </div>
      ))}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-1 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
        >
          <IconCheck className="h-4 w-4" />
          {busy ? "Submitting…" : done ? "Update my log" : "Submit Captain's Log"}
        </button>
        {done ? (
          <span className="text-sm text-text-muted">
            Submitted. You can still edit it until the week closes.
          </span>
        ) : null}
      </div>
    </form>
  );
}
