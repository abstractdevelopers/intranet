"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconSpark } from "@/components/icons";

/**
 * Cheer a promise. A spark rather than a like — the wall is about encouraging
 * people, so the language and the icon both lean warm.
 */
export function CheerButton({
  promiseId,
  initialCount,
  initialCheered,
}: {
  promiseId: string;
  initialCount: number;
  initialCheered: boolean;
}) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [cheered, setCheered] = useState(initialCheered);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    // Optimistic — the count is low-stakes and reverting on failure is cheap.
    const next = !cheered;
    setCheered(next);
    setCount((c) => c + (next ? 1 : -1));
    const res = await fetch(`/api/student/promises/${promiseId}/cheer`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setCheered(!next);
      setCount((c) => c + (next ? -1 : 1));
      return;
    }
    setCheered(Boolean(data.cheered));
    setCount(Number(data.count ?? 0));
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={cheered}
      aria-label={cheered ? "Remove your cheer" : "Cheer this promise"}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
        cheered
          ? "bg-brand-3/40 text-brand-2 dark:text-brand-3"
          : "text-text-muted hover:bg-surface-2 hover:text-text"
      }`}
    >
      <IconSpark className="h-3.5 w-3.5" />
      {count > 0 ? count : "Cheer"}
    </button>
  );
}
