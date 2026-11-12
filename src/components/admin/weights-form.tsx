"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

/**
 * Grading weights for the final score. The three must sum to 100 — enforced on
 * the server too — which is what keeps the overall figure capped at 100%.
 */
export function WeightsForm({
  initial,
}: {
  initial: { assignmentWeight: number; theoryWeight: number; practicalWeight: number };
}) {
  const router = useRouter();
  const [assignment, setAssignment] = useState(String(initial.assignmentWeight));
  const [theory, setTheory] = useState(String(initial.theoryWeight));
  const [practical, setPractical] = useState(String(initial.practicalWeight));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const total = (Number(assignment) || 0) + (Number(theory) || 0) + (Number(practical) || 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "WEIGHTS",
        assignmentWeight: Number(assignment),
        theoryWeight: Number(theory),
        practicalWeight: Number(practical),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't save the weights.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-1.5 text-sm">
          <span className="block font-medium">Assignments %</span>
          <Input type="number" min={0} max={100} value={assignment} onChange={(e) => setAssignment(e.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="block font-medium">Theory %</span>
          <Input type="number" min={0} max={100} value={theory} onChange={(e) => setTheory(e.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="block font-medium">Practical %</span>
          <Input type="number" min={0} max={100} value={practical} onChange={(e) => setPractical(e.target.value)} />
        </label>
      </div>

      <p className={`text-xs ${total === 100 ? "text-text-muted" : "text-danger"}`}>
        Total: {total}% {total === 100 ? "" : "— the three weights must add up to 100."}
      </p>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {saved ? <p className="text-sm font-semibold text-success">Weights saved.</p> : null}

      <button
        type="submit"
        disabled={busy || total !== 100}
        className="rounded-lg bg-brand-1 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save weights"}
      </button>
    </form>
  );
}
