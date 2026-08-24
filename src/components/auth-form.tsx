"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";

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
  }[];
  onSuccess?: (data: { redirect?: string }) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      {fields.map((field) => (
        <div key={field.name} className="space-y-1.5">
          <label htmlFor={field.name} className="block text-sm font-medium">
            {field.label}
          </label>
          <input
            id={field.name}
            name={field.name}
            type={field.type}
            required
            autoComplete={field.autoComplete}
            placeholder={field.placeholder}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus:border-brand-1 focus:outline-2 focus:outline-brand-3"
          />
        </div>
      ))}
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
