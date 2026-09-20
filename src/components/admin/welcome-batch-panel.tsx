"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Result = { sent: number; failed: number; remaining: number };

/**
 * Invitations go out in bounded batches so a large mailing list never turns
 * into one huge send. Staff click until `remaining` reaches zero.
 */
export function WelcomeBatchPanel({ waiting }: { waiting: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resend, setResend] = useState(false);

  const remaining = result ? result.remaining : waiting;

  async function send() {
    if (!confirm(
      resend
        ? "Re-send welcome emails to everyone on the waiting list, including people who already got one?"
        : `Send welcome emails to the next batch of up to 25 accounts? (${remaining} pending)`
    )) return;
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
    <div className="space-y-3">
      <p className="text-sm text-text-muted">
        {remaining === 0
          ? "Every waiting-list account has been invited."
          : `${remaining} waiting-list ${remaining === 1 ? "account has" : "accounts have"} not been invited yet. Each one gets a personal link to set their password.`}
      </p>

      {result ? (
        <p className="text-sm">
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">{result.sent} sent</span>
          {result.failed > 0 ? (
            <>
              {" · "}
              <span className="font-semibold text-red-700 dark:text-red-400">{result.failed} failed</span>
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
          {busy ? "Sending…" : resend ? "Re-send invitations" : "Send next 25 invites"}
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
        Each batch covers up to 25 accounts. Keep clicking until nobody is left pending.
      </p>
    </div>
  );
}