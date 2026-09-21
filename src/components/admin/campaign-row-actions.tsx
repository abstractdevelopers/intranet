"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Action = "SEND_NOW" | "CANCEL" | "RETRY_FAILED";

/**
 * Per-campaign controls in the list. The available actions depend on status:
 * a draft can be sent, a scheduled one can be cancelled, and a finished one can
 * still be deleted.
 */
export function CampaignRowActions({
  id,
  status,
  title,
  sentCount,
}: {
  id: string;
  status: string;
  title: string;
  sentCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: Action, confirmMessage: string) {
    if (!confirm(confirmMessage)) return;
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/admin/campaigns/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "We couldn't complete that action.");
      return;
    }
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete "${title}"? This can't be undone. Emails already delivered are unaffected.`)) return;
    setBusy("delete");
    setError(null);
    const res = await fetch(`/api/admin/campaigns/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "We couldn't delete that campaign.");
      return;
    }
    router.refresh();
  }

  const sendable = status === "DRAFT" || status === "FAILED";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {sendable ? (
        <button
          onClick={() => act("SEND_NOW", `Send "${title}" now? This emails every matching recipient.`)}
          disabled={busy !== null}
          className="rounded-lg bg-brand-1 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
        >
          {busy === "SEND_NOW" ? "Starting…" : "Send now"}
        </button>
      ) : null}

      {status === "SCHEDULED" ? (
        <>
          <button
            onClick={() => act("SEND_NOW", `Send "${title}" immediately instead of waiting for its scheduled time?`)}
            disabled={busy !== null}
            className="rounded-lg bg-brand-1 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
          >
            {busy === "SEND_NOW" ? "Starting…" : "Send now"}
          </button>
          <button
            onClick={() => act("CANCEL", `Cancel the scheduled send of "${title}"?`)}
            disabled={busy !== null}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:border-amber-400 hover:text-amber-700 disabled:opacity-50 dark:hover:text-amber-400"
          >
            {busy === "CANCEL" ? "Cancelling…" : "Cancel send"}
          </button>
        </>
      ) : null}

      {status === "SENDING" ? (
        <span className="text-xs text-text-muted">Sending in the background…</span>
      ) : null}

      {status === "SENT" && sentCount > 0 ? (
        <span className="text-xs text-text-muted">Delivered. Duplicate a draft to send again.</span>
      ) : null}

      <button
        onClick={remove}
        disabled={busy !== null}
        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        {busy === "delete" ? "Deleting…" : "Delete"}
      </button>

      {error ? <span className="text-xs text-red-600 dark:text-red-400">{error}</span> : null}
    </div>
  );
}