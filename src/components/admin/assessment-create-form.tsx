"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Select, Field } from "@/components/ui/input";
import { PATHWAY_LABELS, type Pathway } from "@/lib/constants";

const PATHWAY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All pathways" },
  ...(Object.entries(PATHWAY_LABELS) as [Pathway, string][]).map(([value, label]) => ({ value, label })),
];

/**
 * Create a paper. The window defaults to the academy's shared dates on the
 * server, so a new paper is immediately open in the right window unless staff
 * override it.
 */
export function AssessmentCreateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [kind, setKind] = useState("THEORY");
  const [pathway, setPathway] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        slug,
        kind,
        pathway: pathway || null,
        status: "PUBLISHED",
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't create that assessment.");
      return;
    }
    setTitle("");
    setSlug("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand-1 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-2"
      >
        New assessment
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="a-title">
          <Input
            id="a-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              // Derive a slug from the title until it is edited by hand.
              setSlug(
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, ""),
              );
            }}
            required
            placeholder="Graphics Design — Theory Assessment"
          />
        </Field>
        <Field label="Slug" htmlFor="a-slug" hint="Lowercase letters, numbers and hyphens.">
          <Input id="a-slug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
        </Field>
        <Field label="Kind" htmlFor="a-kind">
          <Select id="a-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="THEORY">Theory</option>
            <option value="PRACTICAL">Practical</option>
          </Select>
        </Field>
        <Field label="Pathway" htmlFor="a-pathway">
          <Select id="a-pathway" value={pathway} onChange={(e) => setPathway(e.target.value)}>
            {PATHWAY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-1 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
