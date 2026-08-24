"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewForm({
  submissionId,
  maxScore,
}: {
  submissionId: string;
  maxScore: number;
}) {
  const router = useRouter();
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(requestRevision: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/submissions/${submissionId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: Number(score || 0),
        feedback: feedback || undefined,
        requestRevision,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't complete that action. Please try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="review-score" className="block text-xs font-semibold text-text-muted">
          Score
        </label>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            id="review-score"
            type="number"
            min={0}
            max={maxScore}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="block w-28 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
          <span className="text-sm text-text-muted">/ {maxScore}</span>
        </div>
      </div>

      <div>
        <label htmlFor="review-feedback" className="block text-xs font-semibold text-text-muted">
          Feedback
        </label>
        <textarea
          id="review-feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={4}
          placeholder="What was strong? What should they improve?"
          className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => review(false)}
          disabled={busy || score === ""}
          className="rounded-lg bg-brand-1 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save review"}
        </button>
        <button
          onClick={() => review(true)}
          disabled={busy}
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-text-muted transition-colors hover:border-red-300 hover:text-red-600 dark:hover:text-red-400"
        >
          Request revision
        </button>
      </div>
    </div>
  );
}
