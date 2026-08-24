"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Attach a resource to a lesson: an external link or a PDF upload (protected storage). */
export function ResourceForm({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("title", title);
    if (file) form.set("file", file);
    else if (url) form.set("url", url);
    const res = await fetch(`/api/admin/lessons/${lessonId}/resources`, { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't complete that action. Please try again.");
      return;
    }
    setTitle("");
    setUrl("");
    setFile(null);
    router.refresh();
  }

  const inputClass =
    "mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand-1 focus:outline-2 focus:outline-brand-3";

  return (
    <form onSubmit={add} className="space-y-3">
      <div>
        <label htmlFor="res-title" className="block text-xs font-semibold text-text-muted">
          Title
        </label>
        <input
          id="res-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="e.g. Week 1 workbook"
          className={inputClass}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="res-url" className="block text-xs font-semibold text-text-muted">
            Link
          </label>
          <input
            id="res-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="res-file" className="block text-xs font-semibold text-text-muted">
            or PDF upload
          </label>
          <input
            id="res-file"
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-3/25 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-brand-1 dark:file:text-brand-3"
          />
        </div>
      </div>
      <p className="text-xs text-text-muted">
        PDFs are stored in protected storage and served through the authenticated document viewer — no public URLs.
      </p>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-1 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
      >
        {busy ? "Adding…" : "Add resource"}
      </button>
    </form>
  );
}
