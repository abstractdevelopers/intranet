"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SubmissionForm({
  assignmentId,
  allowedTypes,
  maxFileSizeMb,
  attemptsLeft,
}: {
  assignmentId: string;
  allowedTypes: string[];
  maxFileSizeMb: number;
  attemptsLeft: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"file" | "url" | "text">(
    allowedTypes.some((t) => ["PDF", "DOC", "DOCX", "ZIP", "IMAGE"].includes(t))
      ? "file"
      : allowedTypes.some((t) => ["GITHUB", "GITLAB", "URL", "REPO"].includes(t))
        ? "url"
        : "text"
  );
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptsFile = allowedTypes.some((t) => ["PDF", "DOC", "DOCX", "ZIP", "IMAGE"].includes(t));
  const acceptsUrl = allowedTypes.some((t) => ["GITHUB", "GITLAB", "URL", "REPO"].includes(t));
  const acceptsText = allowedTypes.includes("TEXT");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData();
    if (mode === "file" && file) form.set("file", file);
    if (mode === "url" && url) form.set("url", url);
    if (mode === "text" && text) form.set("textContent", text);
    const res = await fetch(`/api/student/assignments/${assignmentId}/submit`, {
      method: "POST",
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't complete that action. Please try again.");
      return;
    }
    setFile(null);
    setUrl("");
    setText("");
    router.refresh();
  }

  if (attemptsLeft <= 0) {
    return (
      <p className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-text-muted">
        You&rsquo;ve used all your attempts for this assignment.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Submission type">
        {acceptsFile ? (
          <button
            type="button"
            onClick={() => setMode("file")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              mode === "file"
                ? "border-brand-1 bg-brand-1 text-white"
                : "border-border bg-surface text-text-muted"
            }`}
          >
            File upload
          </button>
        ) : null}
        {acceptsUrl ? (
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              mode === "url"
                ? "border-brand-1 bg-brand-1 text-white"
                : "border-border bg-surface text-text-muted"
            }`}
          >
            Link / repository
          </button>
        ) : null}
        {acceptsText ? (
          <button
            type="button"
            onClick={() => setMode("text")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              mode === "text"
                ? "border-brand-1 bg-brand-1 text-white"
                : "border-border bg-surface text-text-muted"
            }`}
          >
            Written response
          </button>
        ) : null}
      </div>

      {mode === "file" ? (
        <div>
          <label className="block text-xs font-semibold text-text-muted">
            File · up to {maxFileSizeMb}MB
          </label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-3/25 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-brand-1 dark:file:text-brand-3"
          />
        </div>
      ) : null}

      {mode === "url" ? (
        <div>
          <label htmlFor="sub-url" className="block text-xs font-semibold text-text-muted">
            Repository or link
          </label>
          <input
            id="sub-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/you/project"
            className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>
      ) : null}

      {mode === "text" ? (
        <div>
          <label htmlFor="sub-text" className="block text-xs font-semibold text-text-muted">
            Your response
          </label>
          <textarea
            id="sub-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>
      ) : null}

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
        {busy ? "Submitting…" : `Submit work · ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left`}
      </button>
    </form>
  );
}
