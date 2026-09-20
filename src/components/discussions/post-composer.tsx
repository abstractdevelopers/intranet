"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";

type FeedOption = { pathway: string | null; label: string };

/** Composer for a new discussion post. Scope is chosen from the feeds the student belongs to. */
export function PostComposer({
  feeds,
  defaultPathway = null,
}: {
  feeds: FeedOption[];
  defaultPathway?: string | null;
}) {
  const router = useRouter();
  const [pathway, setPathway] = useState<string>(defaultPathway ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/student/discussions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title || undefined, body, pathway: pathway || null }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't post that. Please try again.");
      return;
    }
    setTitle("");
    setBody("");
    setOpen(false);
    router.refresh();
  }

  const inputClass =
    "block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus:border-brand-1 focus:outline-2 focus:outline-brand-3";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-border bg-surface px-5 py-4 text-left text-sm text-text-muted transition-colors hover:border-brand-1/40 hover:text-text"
      >
        Start a discussion…
      </button>
    );
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="d-feed" className="block text-xs font-semibold text-text-muted">
            Post to
          </label>
          <select
            id="d-feed"
            value={pathway}
            onChange={(e) => setPathway(e.target.value)}
            className={`mt-1.5 ${inputClass}`}
          >
            {feeds.map((f) => (
              <option key={f.pathway ?? "general"} value={f.pathway ?? ""}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="d-title" className="block text-xs font-semibold text-text-muted">
            Title <span className="font-normal">(optional)</span>
          </label>
          <input
            id="d-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
            placeholder="What's this about?"
            className={`mt-1.5 ${inputClass}`}
          />
        </div>

        <div>
          <label htmlFor="d-body" className="block text-xs font-semibold text-text-muted">
            Message
          </label>
          <textarea
            id="d-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={4}
            maxLength={5000}
            placeholder="Share an idea, ask a question, or start a conversation…"
            className={`mt-1.5 ${inputClass}`}
          />
        </div>

        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy || !body.trim()}
            className="rounded-lg bg-brand-1 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
          >
            {busy ? "Posting…" : "Post"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm font-medium text-text-muted hover:text-text"
          >
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}