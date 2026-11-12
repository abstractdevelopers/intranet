"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Textarea, Select, Field } from "@/components/ui/input";
import { PATHWAY_LABELS, type Pathway } from "@/lib/constants";

const PATHWAY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All pathways" },
  ...(Object.entries(PATHWAY_LABELS) as [Pathway, string][]).map(([value, label]) => ({ value, label })),
];

function toLocal(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Edit a paper's copy, window and status. */
export function AssessmentSettingsForm({
  id,
  initial,
}: {
  id: string;
  initial: {
    title: string;
    description: string;
    instructions: string;
    pathway: string;
    openAt: string;
    closeAt: string;
    maxScore: number;
    passMark: number;
    status: string;
  };
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [instructions, setInstructions] = useState(initial.instructions);
  const [pathway, setPathway] = useState(initial.pathway);
  const [openAt, setOpenAt] = useState(toLocal(initial.openAt));
  const [closeAt, setCloseAt] = useState(toLocal(initial.closeAt));
  const [maxScore, setMaxScore] = useState(String(initial.maxScore));
  const [passMark, setPassMark] = useState(String(initial.passMark));
  const [status, setStatus] = useState(initial.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/assessments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || null,
        instructions: instructions || null,
        pathway: pathway || null,
        openAt: openAt ? new Date(openAt).toISOString() : null,
        closeAt: closeAt ? new Date(closeAt).toISOString() : null,
        maxScore: Number(maxScore) || 100,
        passMark: Number(passMark) || 0,
        status,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't save the settings.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Title" htmlFor="s-title">
        <Input id="s-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </Field>
      <Field label="Description" htmlFor="s-description">
        <Textarea
          id="s-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </Field>
      <Field label="Instructions" htmlFor="s-instructions" hint="Shown to students at the top of the paper.">
        <Textarea
          id="s-instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={5}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Pathway" htmlFor="s-pathway">
          <Select id="s-pathway" value={pathway} onChange={(e) => setPathway(e.target.value)}>
            {PATHWAY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="s-status">
          <Select id="s-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </Field>
        <Field label="Opens" htmlFor="s-open" hint="10:00 WAT on Thursday by default.">
          <Input id="s-open" type="datetime-local" value={openAt} onChange={(e) => setOpenAt(e.target.value)} />
        </Field>
        <Field label="Closes" htmlFor="s-close" hint="Hard deadline. 2:00 PM WAT on Saturday by default.">
          <Input id="s-close" type="datetime-local" value={closeAt} onChange={(e) => setCloseAt(e.target.value)} />
        </Field>
        <Field label="Maximum score" htmlFor="s-max" hint="Used by practical papers.">
          <Input
            id="s-max"
            type="number"
            min={1}
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
          />
        </Field>
        <Field label="Pass mark (%)" htmlFor="s-pass">
          <Input
            id="s-pass"
            type="number"
            min={0}
            max={100}
            value={passMark}
            onChange={(e) => setPassMark(e.target.value)}
          />
        </Field>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {saved ? <p className="text-sm font-semibold text-success">Settings saved.</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-1 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
