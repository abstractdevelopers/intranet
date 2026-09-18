"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconStudents } from "@/components/icons";

type Credentials = { email: string; temporaryPassword: string; created: boolean };

/**
 * Create a student account and show the temporary password (#1).
 * The password is shown once — staff hand it over out of band until an email
 * provider is wired up.
 */
export function StudentInviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCredentials(null);
    const res = await fetch("/api/admin/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, fullName }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't create that account. Please try again.");
      return;
    }
    setCredentials({ email: data.email, temporaryPassword: data.temporaryPassword, created: true });
    setEmail("");
    setFullName("");
    router.refresh();
  }

  const inputClass =
    "mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand-1 focus:outline-2 focus:outline-brand-3";

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="inv-name" className="block text-xs font-semibold text-text-muted">
            Full name
          </label>
          <input
            id="inv-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="Ada Obi"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="inv-email" className="block text-xs font-semibold text-text-muted">
            Email
          </label>
          <input
            id="inv-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="ada@example.com"
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-1 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
        >
          <IconStudents className="h-4 w-4" />
          {busy ? "Creating…" : "Create student"}
        </button>
      </form>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {credentials ? (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-sm font-semibold">Account created — share these once</p>
          <div className="mt-2 space-y-1 font-mono text-sm">
            <p>{credentials.email}</p>
            <p className="font-semibold">{credentials.temporaryPassword}</p>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            This password is not stored in readable form and won&rsquo;t be shown again. The
            student must change it on first sign-in.
          </p>
        </div>
      ) : null}
    </div>
  );
}