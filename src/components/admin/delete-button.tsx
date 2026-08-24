"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteButton({
  endpoint,
  label = "Delete",
  confirmMessage = "Delete this? This can't be undone.",
  redirectTo,
}: {
  endpoint: string;
  label?: string;
  confirmMessage?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!confirm(confirmMessage)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(endpoint, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't complete that action. Please try again.");
      return;
    }
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={remove}
        disabled={busy}
        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        {busy ? "Deleting…" : label}
      </button>
      {error ? <span className="text-xs text-red-600 dark:text-red-400">{error}</span> : null}
    </span>
  );
}
