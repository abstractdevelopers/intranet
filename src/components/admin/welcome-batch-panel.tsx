"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Result = { sent: number; failed: number; remaining: number };

/**
 * Invitations go out in bounded batches so a large mailing list never turns
 * into one huge send. Progress comes from the server on every render, so the
 * counts survive a refresh and staff can always see where they stopped.
 */
export function WelcomeBatchPanel({
  pending,
  invited,
  total,
}: {
  /** Waiting-list accounts not yet emailed. */
  pending: number;
  /** Waiting-list accounts already emailed. */
  invited: number;
  /** All waiting-list accounts. */
  total: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resend, setResend] = useState(false);

  const remaining = result ? result.remaining : pending;
  const done = total - remaining;
  const pct = total === 0 ? 100 : Math.round((done / total) * 100);

  async function send() {
    const count = Math.min(25, remaining);
    const msg = resend
      ? `Re-send welcome emails to everyone on the waiting list, including the ${invited} already emailed?`
      : `Send welcome emails to the next ${count} ${count === 1 ? "account" : "accounts"}?`;
    if (!confirm(msg)) return;

    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/students/welcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resend }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't send those invitations. Please try again.");
      return;
    }
    setResult({ sent: data.sent, failed: data.failed, remaining: data.remaining });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Progress bar — the honest answer to "where did I stop?" */}
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm">
            <span className="text-lg font-bold">{done}</span>
            <span className="text-text-muted"> of {total} invited</span>
          </p>
          <p className="text-xs text-text-muted">{pct}%</p>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="Invitations sent"
        >
          <div className="h-full rounded-full bg-brand-1 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-text-muted">
          {remaining === 0 ? (
            "Every waiting-list account has been emailed."
          ) : (
            <>
              {remaining} still to send.{" "}
              <Link href="/admin/students?tab=waiting" className="underline hover:text-text">
                See who they are
              </Link>
            </>
          )}
        </p>
      </div>

      {result ? (
        <p className="text-sm">
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">{result.sent} sent</span>
          {result.failed > 0 ? (
            <>
              {" · "}
              <span className="font-semibold text-red-700 dark:text-red-400">
                {result.failed} failed — re-send with the checkbox below to retry
              </span>
            </>
          ) : null}
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-700 dark:text-red-400">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={send}
          disabled={busy || (remaining === 0 && !resend)}
          className="rounded-lg bg-brand-1 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy
            ? "Sending…"
            : remaining === 0 && !resend
              ? "All invited"
              : `Send next ${Math.min(25, remaining)}`}
        </button>
        <label className="flex items-center gap-2 text-xs text-text-muted">
          <input
            type="checkbox"
            checked={resend}
            onChange={(e) => setResend(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Include people already invited
        </label>
      </div>

      <p className="text-xs text-text-muted">
        Each send covers up to 25 accounts. Progress is saved, so you can refresh or
        come back later and carry on where you left off.
      </p>
    </div>
  );
}