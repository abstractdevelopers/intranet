"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconCheckCircle } from "@/components/icons";

/**
 * The three-field review form. Deliberately not a free-text box: naming what
 * landed, one suggestion and one question is what keeps peer feedback from
 * becoming either empty praise or vague criticism.
 */
export function ReviewForm({
  submissionId,
  alreadyReviewed,
}: {
  submissionId: string;
  alreadyReviewed: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [whatLanded, setWhatLanded] = useState("");
  const [oneSuggestion, setOneSuggestion] = useState("");
  const [oneQuestion, setOneQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/student/peer-body/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, whatLanded, oneSuggestion, oneQuestion }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't post that review. Please try again.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (alreadyReviewed) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
        <IconCheckCircle className="h-4 w-4" /> You reviewed this
      </p>
    );
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} type="button" className="px-3 py-1.5 text-xs">
        Review this
      </Button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-2 p-4">
      <div className="space-y-3">
        <div>
          <label htmlFor={`landed-${submissionId}`} className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            What landed for you?
          </label>
          <textarea
            id={`landed-${submissionId}`}
            value={whatLanded}
            rows={2}
            onChange={(e) => setWhatLanded(e.target.value)}
            className="mt-1 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-brand-1"
          />
        </div>
        <div>
          <label htmlFor={`suggest-${submissionId}`} className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            One thing they could try next
          </label>
          <textarea
            id={`suggest-${submissionId}`}
            value={oneSuggestion}
            rows={2}
            onChange={(e) => setOneSuggestion(e.target.value)}
            className="mt-1 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-brand-1"
          />
        </div>
        <div>
          <label htmlFor={`question-${submissionId}`} className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            A question to leave them thinking <span className="normal-case">(optional)</span>
          </label>
          <textarea
            id={`question-${submissionId}`}
            value={oneQuestion}
            rows={2}
            onChange={(e) => setOneQuestion(e.target.value)}
            className="mt-1 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-brand-1"
          />
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="mt-4 flex items-center gap-2">
        <Button
          onClick={submit}
          disabled={busy || whatLanded.trim().length < 3 || oneSuggestion.trim().length < 3}
          type="button"
        >
          {busy ? "Posting…" : "Post review"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy} type="button">
          Cancel
        </Button>
      </div>
    </div>
  );
}
