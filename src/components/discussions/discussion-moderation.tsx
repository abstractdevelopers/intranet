"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Post moderation controls. The reason is captured here so it can be shown to
 * the author in their notification — moderation should never be silent.
 */
export function DiscussionModeration({
  targetId,
  target,
  status,
  preview,
}: {
  targetId: string;
  target: "POST" | "REPLY";
  status: string;
  preview: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const hidden = status === "HIDDEN";

  async function act(action: "HIDE" | "RESTORE" | "DELETE") {
    if (action === "DELETE") {
      if (!confirm(`Permanently delete this ${target.toLowerCase()}?\n\n"${preview}"`)) return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/discussions/${targetId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, target, reason: reason || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "That didn't work. Please try again.");
      return;
    }
    router.refresh();
  }

  const btn = "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hidden ? (
        <button
          onClick={() => act("RESTORE")}
          disabled={busy}
          className={`${btn} bg-brand-1 text-white hover:bg-brand-2`}
        >
          Restore
        </button>
      ) : (
        <>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (shown to author)"
            aria-label="Moderation reason"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs placeholder:text-text-muted focus:border-brand-1 focus:outline-2 focus:outline-brand-3"
          />
          <button
            onClick={() => act("HIDE")}
            disabled={busy}
            className={`${btn} border border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950/40`}
          >
            {busy ? "Working…" : "Hide"}
          </button>
        </>
      )}
      <button
        onClick={() => act("DELETE")}
        disabled={busy}
        className={`${btn} border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40`}
      >
        Delete
      </button>
      {error ? (
        <p role="alert" className="w-full text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}