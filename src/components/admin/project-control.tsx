"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Restrict or restore a student project (#16). */
export function ProjectControl({
  projectId,
  visibility,
}: {
  projectId: string;
  visibility: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const restricted = visibility === "RESTRICTED";

  async function act() {
    let reason: string | undefined;
    if (!restricted) {
      const input = prompt(
        "Why is this project being restricted? The student will see this reason."
      );
      if (!input || !input.trim()) return;
      reason = input.trim();
    } else if (!confirm("Restore this project to the student's control?")) {
      return;
    }

    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/projects/${projectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: restricted ? "RESTORE" : "RESTRICT", reason }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't complete that action.");
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={act}
        disabled={busy}
        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
          restricted
            ? "border-border text-text-muted hover:border-brand-1 hover:text-brand-1"
            : "border-border text-text-muted hover:border-red-300 hover:text-red-600 dark:hover:text-red-400"
        }`}
      >
        {busy ? "…" : restricted ? "Restore" : "Restrict"}
      </button>
      {error ? <span className="text-xs text-red-600 dark:text-red-400">{error}</span> : null}
    </span>
  );
}