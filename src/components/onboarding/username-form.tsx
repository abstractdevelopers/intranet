"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconCheck, IconCheckCircle } from "@/components/icons";

type Result = { available: boolean; message: string } | null;

/**
 * Choose the public username (#1). Availability is checked as the student
 * types, but the server always re-validates on submit — this is a convenience,
 * not the enforcement point.
 */
export function UsernameForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [username, setUsername] = useState(initial);
  const [result, setResult] = useState<Result>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = username.trim().toLowerCase();

  useEffect(() => {
    if (!trimmed) return;
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/onboarding/username?username=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setResult(
          data.available
            ? { available: true, message: "Available" }
            : { available: false, message: data.error ?? "That username isn't available." }
        );
      } catch {
        /* aborted or offline — submit still validates server-side */
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  // Only trust a result that matches what's currently typed.
  const settled = result && trimmed ? result : null;
  const available = settled?.available === true;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/onboarding/username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't save that username. Please try again.");
      return;
    }
    router.push("/onboarding/profile");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="username" className="block text-xs font-semibold text-text-muted">
          Username
        </label>
        <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 focus-within:border-brand-1">
          <span className="text-sm text-text-muted">@</span>
          <input
            id="username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setResult(null);
            }}
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="yourname"
            className="w-full bg-transparent text-sm focus:outline-none"
          />
          {available ? (
            <IconCheckCircle className="h-4.5 w-4.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : null}
        </div>
        <p
          className={`mt-1 text-xs ${
            available ? "text-emerald-600 dark:text-emerald-400" : "text-text-muted"
          }`}
        >
          {settled?.message ??
            "3–30 characters: lowercase letters, numbers, dots, underscores."}
        </p>
      </div>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy || !available}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-1 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
      >
        <IconCheck className="h-4 w-4" />
        {busy ? "Saving…" : "Claim username"}
      </button>
    </form>
  );
}