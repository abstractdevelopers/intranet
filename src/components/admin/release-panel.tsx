"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Progress = { sent: number; failed: number; remaining: number; total: number; done: boolean };

/**
 * "Release results" controls.
 *
 * RELEASE recomputes every student's score, then emails each report in batches
 * and marks it released. On this plan the cron only runs daily, so the button
 * loops the action until the server reports done — the same pattern the campaign
 * sender uses for a large send. Because a result is stamped before its email
 * goes out, re-clicking can never double-send.
 */
export function ReleasePanel({
  total,
  released,
}: {
  total: number;
  released: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [recomputeNote, setRecomputeNote] = useState<string | null>(null);

  const sentCount = progress ? progress.sent : released;
  const remaining = progress ? progress.remaining : total - released;
  const pct = total === 0 ? 100 : Math.round((sentCount / total) * 100);

  async function recompute() {
    setBusy("RECOMPUTE");
    setError(null);
    setRecomputeNote(null);
    const res = await fetch("/api/admin/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "RECOMPUTE" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "We couldn't recompute the results.");
      return;
    }
    setRecomputeNote(`${data.count} result${data.count === 1 ? "" : "s"} recalculated.`);
    router.refresh();
  }

  async function release() {
    if (
      !confirm(
        `Release results to all ${total} students? Each will receive their report by email, and their result becomes visible in the portal.`,
      )
    ) {
      return;
    }
    setBusy("RELEASE");
    setError(null);
    let guard = 0;
    try {
      let last: Progress | undefined;
      do {
        guard += 1;
        const res = await fetch("/api/admin/results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "RELEASE" }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "We couldn't release the results.");
          break;
        }
        const data = await res.json().catch(() => ({}));
        last = data?.progress;
        if (!last) break;
        setProgress(last);
      } while (!last.done && guard < 80);
    } finally {
      setBusy(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm">
            <span className="text-lg font-bold">{sentCount}</span>
            <span className="text-text-muted"> of {total} released</span>
          </p>
          <p className="text-xs text-text-muted">{pct}%</p>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={sentCount}
          aria-valuemin={0}
          aria-valuemax={total}
        >
          <div className="h-full rounded-full bg-brand-1 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-text-muted">
          {remaining === 0
            ? "Every student has received their report."
            : `${remaining} still to send.`}
        </p>
      </div>

      {progress ? (
        <p className="text-sm">
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">{progress.sent} sent</span>
          {progress.failed > 0 ? (
            <>
              {" · "}
              <span className="font-semibold text-red-700 dark:text-red-400">
                {progress.failed} failed — click Release again to retry
              </span>
            </>
          ) : null}
        </p>
      ) : null}

      {recomputeNote ? <p className="text-sm text-success">{recomputeNote}</p> : null}
      {error ? <p className="text-sm text-red-700 dark:text-red-400">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={release}
          disabled={busy !== null || remaining === 0}
          className="rounded-lg bg-brand-1 px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "RELEASE" ? "Releasing…" : remaining === 0 ? "Results released" : "Release results"}
        </button>
        <button
          type="button"
          onClick={recompute}
          disabled={busy !== null}
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-text-muted transition-colors hover:border-brand-1 hover:text-brand-1 disabled:opacity-50"
        >
          {busy === "RECOMPUTE" ? "Recalculating…" : "Recalculate scores"}
        </button>
      </div>

      <p className="text-xs text-text-muted">
        Releasing sends each student their individual report by email and makes their result visible in the
        portal. The send is saved as it goes, so you can refresh or come back later and carry on.
      </p>
    </div>
  );
}
