"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconWriting } from "@/components/icons";

/**
 * Submit or update the viewer's work in a round. One form, reused for create
 * and edit — the API upserts on (round, author).
 */
export function SubmitWorkForm({
  roundId,
  initial,
}: {
  roundId: string;
  initial?: { title: string; body: string; linkUrl: string | null } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [linkUrl, setLinkUrl] = useState(initial?.linkUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/student/peer-body/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundId, title, body, linkUrl }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't save that. Please try again.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} type="button">
        <IconWriting className="h-4 w-4" />
        {initial ? "Edit my submission" : "Submit my work"}
      </Button>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="space-y-3">
        <div>
          <label htmlFor="pb-title" className="text-sm font-semibold">
            Title
          </label>
          <input
            id="pb-title"
            value={title}
            maxLength={160}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What is this piece?"
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-brand-1"
          />
        </div>
        <div>
          <label htmlFor="pb-body" className="text-sm font-semibold">
            Your work
          </label>
          <textarea
            id="pb-body"
            value={body}
            rows={5}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Describe it, or paste the piece itself. Two or three sentences is plenty."
            className="mt-1 w-full resize-y rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-brand-1"
          />
        </div>
        <div>
          <label htmlFor="pb-link" className="text-sm font-semibold">
            Link <span className="font-normal text-text-muted">(optional)</span>
          </label>
          <input
            id="pb-link"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-brand-1"
          />
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="mt-4 flex items-center gap-2">
        <Button onClick={submit} disabled={busy || title.trim().length < 2 || body.trim().length < 10} type="button">
          {busy ? "Saving…" : initial ? "Update submission" : "Submit"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy} type="button">
          Cancel
        </Button>
      </div>
    </div>
  );
}
