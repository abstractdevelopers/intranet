"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PayButtons({
  providers,
  amount,
}: {
  providers: { name: string; label: string }[];
  amount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pay(provider: string) {
    setBusy(provider);
    setError(null);
    const res = await fetch("/api/student/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "We couldn't complete that action. Please try again.");
      return;
    }
    router.push(data.url);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {providers.map((p) => (
          <button
            key={p.name}
            onClick={() => pay(p.name)}
            disabled={busy !== null}
            className="rounded-lg bg-brand-1 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
          >
            {busy === p.name ? "Starting checkout…" : `Pay ₦${amount.toLocaleString("en-NG")} with ${p.label}`}
          </button>
        ))}
      </div>
      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
