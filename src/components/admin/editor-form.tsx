"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type EditorField =
  | { kind: "text"; name: string; label: string; required?: boolean; placeholder?: string }
  | { kind: "number"; name: string; label: string; required?: boolean; min?: number }
  | { kind: "datetime"; name: string; label: string }
  | { kind: "textarea"; name: string; label: string; rows?: number }
  | { kind: "select"; name: string; label: string; options: { value: string; label: string }[] }
  | { kind: "multiselect"; name: string; label: string; options: string[] };

type Values = Record<string, string | number | string[] | null>;

function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Generic admin editor: renders a field config, submits JSON to an endpoint. */
export function EditorForm({
  endpoint,
  method = "POST",
  fields,
  initial = {},
  submitLabel,
  redirectTo,
}: {
  endpoint: string;
  method?: "POST" | "PATCH";
  fields: EditorField[];
  initial?: Record<string, unknown>;
  submitLabel: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => {
    const v: Values = {};
    for (const f of fields) {
      const raw = initial[f.name];
      if (f.kind === "datetime") v[f.name] = toDateTimeLocal(raw as string);
      else if (f.kind === "multiselect") v[f.name] = Array.isArray(raw) ? (raw as string[]) : [];
      else v[f.name] = raw === null || raw === undefined ? "" : (raw as string | number);
    }
    return v;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(name: string, value: string | number | string[]) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const body: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.name];
      if (f.kind === "number") body[f.name] = v === "" ? undefined : Number(v);
      else if (f.kind === "datetime") body[f.name] = v ? new Date(v as string).toISOString() : null;
      else if (f.kind === "multiselect") body[f.name] = v;
      else body[f.name] = v === "" ? undefined : v;
    }

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't complete that action. Please try again.");
      return;
    }
    if (redirectTo) router.push(redirectTo.replace("{id}", data.id ?? ""));
    router.refresh();
    if (method === "POST" && !redirectTo) {
      // reset for another entry
      setValues((prev) => {
        const next: Values = { ...prev };
        for (const f of fields) next[f.name] = f.kind === "multiselect" ? [] : "";
        return next;
      });
    }
  }

  const inputClass =
    "mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand-1 focus:outline-2 focus:outline-brand-3";

  return (
    <form onSubmit={submit} className="space-y-4">
      {fields.map((f) => (
        <div key={f.name}>
          <label htmlFor={`ef-${f.name}`} className="block text-xs font-semibold text-text-muted">
            {f.label}
          </label>
          {f.kind === "textarea" ? (
            <textarea
              id={`ef-${f.name}`}
              rows={f.rows ?? 4}
              value={(values[f.name] as string) ?? ""}
              onChange={(e) => set(f.name, e.target.value)}
              className={inputClass}
            />
          ) : f.kind === "select" ? (
            <select
              id={`ef-${f.name}`}
              value={(values[f.name] as string) ?? ""}
              onChange={(e) => set(f.name, e.target.value)}
              className={inputClass}
            >
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.kind === "multiselect" ? (
            <div className="mt-1.5 flex flex-wrap gap-2">
              {f.options.map((o) => {
                const selected = (values[f.name] as string[]).includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() =>
                      set(
                        f.name,
                        selected
                          ? (values[f.name] as string[]).filter((x) => x !== o)
                          : [...(values[f.name] as string[]), o]
                      )
                    }
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                      selected
                        ? "border-brand-1 bg-brand-1 text-white"
                        : "border-border bg-surface text-text-muted"
                    }`}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          ) : (
            <input
              id={`ef-${f.name}`}
              type={f.kind === "number" ? "number" : f.kind === "datetime" ? "datetime-local" : "text"}
              required={"required" in f && f.required}
              min={f.kind === "number" ? f.min : undefined}
              placeholder={"placeholder" in f ? f.placeholder : undefined}
              value={(values[f.name] as string | number) ?? ""}
              onChange={(e) => set(f.name, e.target.value)}
              className={inputClass}
            />
          )}
        </div>
      ))}

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
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
