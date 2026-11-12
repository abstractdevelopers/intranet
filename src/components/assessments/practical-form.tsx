"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AssessmentView } from "@/lib/assessments";
import { Textarea, Input, Field } from "@/components/ui/input";
import { IconCheckCircle, IconFile } from "@/components/icons";

/**
 * Practical paper submission.
 *
 * The deliverable can be a written response, a hosted link, an uploaded file,
 * or a combination. Everything is posted as multipart form data so a file can
 * travel alongside the text, matching the assignment submission flow.
 */
export function PracticalForm({ assessment }: { assessment: AssessmentView }) {
  const router = useRouter();
  const submission = assessment.submission;

  const [text, setText] = useState(submission?.textContent ?? "");
  const [url, setUrl] = useState(submission?.externalUrl ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const closed = assessment.window.closed;
  const upcoming = assessment.window.upcoming;
  const graded = submission?.status === "GRADED";
  const disabled = closed || upcoming || graded;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData();
    if (text.trim()) form.set("textContent", text);
    if (url.trim()) form.set("url", url);
    if (file) form.set("file", file);

    const res = await fetch(`/api/student/assessments/${assessment.id}/submit`, {
      method: "POST",
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "We couldn't submit your work.");
      return;
    }
    setDone(true);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Practical assessment</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{assessment.title}</h1>
        {assessment.description ? (
          <p className="mt-2 text-sm text-text-muted">{assessment.description}</p>
        ) : null}
      </header>

      {assessment.instructions ? (
        <div className="rounded-xl border border-border bg-surface-2 p-5 text-sm leading-7 text-text">
          <p className="eyebrow mb-2">Instructions</p>
          <p className="whitespace-pre-wrap">{assessment.instructions}</p>
        </div>
      ) : null}

      {upcoming ? (
        <div className="rounded-xl border border-brand-1/30 bg-brand-3/15 p-5">
          <p className="text-sm font-semibold">This assessment opens on Thursday 12 November at 10:00 WAT.</p>
        </div>
      ) : null}

      {closed && !graded ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-5">
          <p className="text-sm font-semibold text-danger">The submission deadline has passed.</p>
          <p className="mt-1 text-sm text-text-muted">
            {submission ? "Your work was submitted before the deadline." : "No submission was recorded."}
          </p>
        </div>
      ) : null}

      {graded ? (
        <div className="rounded-xl border border-success/30 bg-success/10 p-5">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-success">
            <IconCheckCircle className="h-5 w-5" /> Marked
            {submission?.score !== null && submission?.score !== undefined
              ? ` — ${Math.round(submission.score)}%`
              : ""}
          </p>
          {submission?.feedback ? <p className="mt-1 text-sm text-text-muted">{submission.feedback}</p> : null}
        </div>
      ) : null}

      {submission && !graded ? (
        <div className="rounded-xl border border-border bg-surface p-5 text-sm">
          <p className="font-semibold">Your submission is in.</p>
          <p className="mt-1 text-text-muted">
            Submitted{" "}
            {submission.submittedAt.toLocaleString("en-NG", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {closed ? "" : " — you can replace it until the deadline."}
          </p>
        </div>
      ) : null}

      {done ? (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          Saved. You can update it until the deadline.
        </p>
      ) : null}

      {!disabled ? (
        <form onSubmit={submit} className="space-y-5">
          <Field label="Your response" htmlFor="practical-text" hint="Explain what you made and the thinking behind it.">
            <Textarea
              id="practical-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="Describe your deliverable…"
            />
          </Field>

          <Field label="Link to your work" htmlFor="practical-url" hint="A hosted file, video, repository, or published piece.">
            <Input
              id="practical-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </Field>

          <Field label="Upload a file" htmlFor="practical-file" hint="PDF, document, image, or a short video (max 4MB).">
            <input
              id="practical-file"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-1 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:opacity-90"
            />
          </Field>

          {submission?.files.length ? (
            <div className="rounded-lg border border-border bg-surface-2 p-4 text-sm">
              <p className="eyebrow mb-2">Currently attached</p>
              <ul className="space-y-1">
                {submission.files.map((f) => (
                  <li key={f.id}>
                    <a
                      href={`/api/documents/${f.documentId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 font-medium text-brand-1 hover:underline dark:text-brand-3"
                    >
                      <IconFile className="h-4 w-4" /> {f.fileName}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-text-muted">
                Uploading a new file replaces the attached one.
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-1 px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Submitting…" : submission ? "Update submission" : "Submit assessment"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
