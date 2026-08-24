"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconWorkspace } from "@/components/icons";

export function ProvisionWorkspaceButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function provision() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/student/workspace", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setError("We couldn't complete that action. Please try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={provision}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-1 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
      >
        <IconWorkspace className="h-4 w-4" />
        {busy ? "Provisioning…" : "Provision my workspace"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
