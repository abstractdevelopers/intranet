"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { IconEye, IconEyeOff } from "./icons";

export function AuthForm({
  endpoint,
  submitLabel,
  fields,
  onSuccess,
}: {
  endpoint: string;
  submitLabel: string;
  fields: {
    name: string;
    label: string;
    type: string;
    autoComplete?: string;
    placeholder?: string;
    /** Pre-filled value. Required for `type: "hidden"` fields like tokens. */
    value?: string;
  }[];
  onSuccess?: (data: { redirect?: string }) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "We couldn't complete that action. Please try again.");
        return;
      }
      if (onSuccess) onSuccess(data);
      else if (data.redirect) router.push(data.redirect);
    } catch {
      setError("We couldn't complete that action. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {fields.map((field) => {
        const isPassword = field.type === "password";
        const show = revealed[field.name] ?? false;

        // Hidden inputs carry server-issued values such as reset tokens and
        // must never be rendered with a visible label wrapper.
        if (field.type === "hidden") {
          return <input key={field.name} type="hidden" name={field.name} defaultValue={field.value ?? ""} />;
        }

        return (
          <div key={field.name} className="space-y-1.5">
            <label htmlFor={field.name} className="block text-sm font-medium">
              {field.label}
            </label>
            <div className="relative">
              <input
                id={field.name}
                name={field.name}
                type={isPassword && show ? "text" : field.type}
                required
                autoComplete={field.autoComplete}
                placeholder={field.placeholder}
                className={`w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus:border-brand-1 focus:outline-2 focus:outline-brand-3 ${
                  isPassword ? "pr-11" : ""
                }`}
              />
              {isPassword ? (
                <button
                  type="button"
                  onClick={() => setRevealed((r) => ({ ...r, [field.name]: !show }))}
                  aria-label={show ? `Hide ${field.label}` : `Show ${field.label}`}
                  aria-pressed={show}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-brand-1"
                >
                  {show ? <IconEyeOff className="h-4.5 w-4.5" /> : <IconEye className="h-4.5 w-4.5" />}
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Please wait…" : submitLabel}
      </Button>
    </form>
  );
}
