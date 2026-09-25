"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PATHWAY_LABELS, PATHWAYS } from "@/lib/constants";

/** Open a Peer Body round: title, reviewer prompt, and optional scope. */
export function PeerBodyRoundForm({
  courses,
}: {
  courses: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [courseId, setCourseId] = useState("");
  const [pathway, setPathway] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/peer-body/rounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, prompt, courseId, pathway, closesAt }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't open that round.");
      return;
    }
    setTitle("");
    setPrompt("");
    setCourseId("");
    setPathway("");
    setClosesAt("");
    router.refresh();
  }

  const input =
    "mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-brand-1";

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="round-title" className="text-sm font-semibold">
          Round title
        </label>
        <input
          id="round-title"
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Logo drafts — first look"
          className={input}
        />
      </div>
      <div>
        <label htmlFor="round-prompt" className="text-sm font-semibold">
          Prompt for reviewers
        </label>
        <textarea
          id="round-prompt"
          value={prompt}
          rows={3}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What should reviewers focus on? e.g. Is the mark readable at small sizes?"
          className={`${input} resize-y`}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="round-course" className="text-sm font-semibold">
            Course <span className="font-normal text-text-muted">(optional)</span>
          </label>
          <select
            id="round-course"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className={input}
          >
            <option value="">Academy-wide</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="round-pathway" className="text-sm font-semibold">
            Pathway <span className="font-normal text-text-muted">(optional)</span>
          </label>
          <select
            id="round-pathway"
            value={pathway}
            onChange={(e) => setPathway(e.target.value)}
            className={input}
          >
            <option value="">Any</option>
            {Object.keys(PATHWAYS).map((p) => (
              <option key={p} value={p}>
                {PATHWAY_LABELS[p as keyof typeof PATHWAY_LABELS]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="round-closes" className="text-sm font-semibold">
            Closes <span className="font-normal text-text-muted">(optional)</span>
          </label>
          <input
            id="round-closes"
            type="date"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className={input}
          />
        </div>
      </div>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <Button onClick={submit} disabled={busy || title.trim().length < 3 || prompt.trim().length < 5} type="button">
        {busy ? "Opening…" : "Open round"}
      </Button>
    </div>
  );
}
