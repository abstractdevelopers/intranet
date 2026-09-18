"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Staff review of a Captain's Log (#12, #16). */
export function CaptainLogReview({ logId, reviewed }: { logId: string; reviewed: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(markReviewed: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/captains-log/${logId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewNote: note || undefined, markReviewed }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't save that. Please try again.");
      return;
    }
    setNote("");
    router.refresh();
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <label htmlFor={`note-${logId}`} className="block text-xs font-semibold text-text-muted">
        Note to the student (optional)
      </label>
      <textarea
        id={`note-${logId}`}
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything you want them to know about this reflection."
        className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
      />
      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => submit(true)}
          className="rounded-lg bg-brand-1 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-2 disabled:opacity-50"
        >
          {busy ? "Saving…" : reviewed ? "Save note" : "Mark reviewed"}
        </button>
        {reviewed ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => submit(false)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-muted hover:text-text disabled:opacity-50"
          >
            Reopen
          </button>
        ) : null}
      </div>
    </div>
  );
}