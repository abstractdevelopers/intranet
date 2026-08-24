"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StudentStatusButton({ studentId, status }: { studentId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const suspend = status !== "SUSPENDED";

  async function act() {
    if (suspend && !confirm("Suspend this student? They will lose access immediately.")) return;
    setBusy(true);
    await fetch(`/api/admin/students/${studentId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: suspend ? "SUSPEND" : "REACTIVATE" }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={act}
      disabled={busy}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
        suspend
          ? "border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
          : "bg-brand-1 text-white hover:bg-brand-2"
      }`}
    >
      {busy ? "Working…" : suspend ? "Suspend student" : "Reactivate student"}
    </button>
  );
}
