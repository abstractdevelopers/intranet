"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconEye, IconEyeOff } from "@/components/icons";

const inputClass =
  "mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 pr-11 text-sm focus:border-brand-1 focus:outline-2 focus:outline-brand-3";

/**
 * A password field with its own show/hide control. Defined at module scope so
 * it keeps a stable identity — a component created during render would remount
 * on every keystroke and drop focus.
 */
function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  hint,
  show,
  onToggle,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          className={inputClass}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? `Hide ${label}` : `Show ${label}`}
          aria-pressed={show}
          className="absolute bottom-0 right-0 flex h-10 w-11 items-center justify-center text-text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-brand-1"
        >
          {show ? <IconEyeOff className="h-4.5 w-4.5" /> : <IconEye className="h-4.5 w-4.5" />}
        </button>
      </div>
      {hint ? <p className="mt-1 text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

/** Change the temporary password issued by the academy (#1, step 1). */
export function PasswordSetupForm() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<"current" | "next" | "confirm" | null>(null);

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

  return (
    <form onSubmit={submit} className="space-y-4">
      <PasswordField
        id="current"
        label="Temporary password"
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
        show={reveal === "current"}
        onToggle={() => setReveal(reveal === "current" ? null : "current")}
      />
      <PasswordField
        id="next"
        label="New password"
        value={next}
        onChange={setNext}
        autoComplete="new-password"
        hint="At least 8 characters."
        show={reveal === "next"}
        onToggle={() => setReveal(reveal === "next" ? null : "next")}
      />
      <PasswordField
        id="confirm"
        label="Confirm new password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        show={reveal === "confirm"}
        onToggle={() => setReveal(reveal === "confirm" ? null : "confirm")}
      />
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
