"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Re-issue a student's temporary password (#1). */
export function IssuePasswordButton({
  studentId,
  hasTemporaryPassword,
}: {
  studentId: string;
  hasTemporaryPassword: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function issue() {
    const confirmed = confirm(
      hasTemporaryPassword
        ? "Issue a new temporary password? Their current password and all active sessions will stop working."
        : "Issue a temporary password? This signs them out and forces a password change on next sign-in."
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setPassword(null);
    const res = await fetch(`/api/admin/students/${studentId}/password`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't issue a password. Please try again.");
      return;
    }
    setPassword(data.temporaryPassword);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={issue}
        disabled={busy}
        className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:border-brand-1 hover:text-brand-1 disabled:opacity-50"
      >
        {busy ? "Issuing…" : hasTemporaryPassword ? "Re-issue temporary password" : "Issue temporary password"}
      </button>
      {password ? (
        <p className="rounded-lg border border-amber-300/60 bg-amber-50/60 px-3 py-2 font-mono text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
          {password}
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}