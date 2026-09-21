"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Action = "SEND_NOW" | "CANCEL" | "RETRY_FAILED" | "DRAIN";

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

  /**
   * Drive a paused or in-flight send to completion. On this plan the cron only
   * runs once a day, so the "Resume send" button loops the DRAIN action until
   * the campaign reports done.
   */
  async function resume() {
    setBusy("DRAIN");
    setError(null);
    let guard = 0;
    try {
      let progress: { done: boolean } | undefined;
      do {
        guard += 1;
        const res = await fetch(`/api/admin/campaigns/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "DRAIN" }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "We couldn't continue that send.");
          break;
        }
        const data = await res.json().catch(() => ({}));
        progress = data?.progress;
        if (!progress) break;
      } while (!progress.done && guard < 60);
    } finally {
      setBusy(null);
      router.refresh();
    }
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
        <button
          onClick={resume}
          disabled={busy !== null}
          className="rounded-lg bg-brand-1 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
        >
          {busy === "DRAIN" ? "Sending…" : "Resume send"}
        </button>
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