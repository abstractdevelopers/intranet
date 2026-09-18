"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Change the temporary password issued by the academy (#1, step 1). */
export function PasswordSetupForm() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/onboarding/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't update your password. Please try again.");
      return;
    }
    router.push(data.redirect ?? "/onboarding");
    router.refresh();
  }

  const inputClass =
    "mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand-1 focus:outline-2 focus:outline-brand-3";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="cur-pw" className="block text-xs font-semibold text-text-muted">
          Temporary password
        </label>
        <input
          id="cur-pw"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="new-pw" className="block text-xs font-semibold text-text-muted">
          New password
        </label>
        <input
          id="new-pw"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          className={inputClass}
        />
        <p className="mt-1 text-xs text-text-muted">At least 8 characters.</p>
      </div>
      <div>
        <label htmlFor="con-pw" className="block text-xs font-semibold text-text-muted">
          Confirm new password
        </label>
        <input
          id="con-pw"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className={inputClass}
        />
      </div>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-1 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Set my password"}
      </button>
    </form>
  );
}
