"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Curate one portfolio piece: edit details, feature, hide, or remove (#4). */
export function ProjectCard({
  project,
}: {
  project: {
    id: string;
    title: string;
    summary: string;
    description: string | null;
    visibility: string;
    featured: boolean;
    restrictedReason: string | null;
    courseName: string | null;
    externalUrl: string | null;
    repoUrl: string | null;
    likeCount: number;
  };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [summary, setSummary] = useState(project.summary);
  const [description, setDescription] = useState(project.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const restricted = project.visibility === "RESTRICTED";

  async function patch(body: Record<string, unknown>, reload = true) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/student/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't save that. Please try again.");
      return false;
    }
    if (reload) router.refresh();
    return true;
  }

  async function remove() {
    if (!confirm(`Remove "${project.title}" from your portfolio?`)) return;
    setBusy(true);
    const res = await fetch(`/api/student/projects/${project.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  const inputClass =
    "mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand-1 focus:outline-2 focus:outline-brand-3";

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{project.title}</h3>
            {project.featured ? (
              <span className="rounded-full bg-brand-3/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-2 dark:text-brand-3">
                featured
              </span>
            ) : null}
            {project.visibility === "HIDDEN" ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                hidden
              </span>
            ) : null}
            {restricted ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800 dark:bg-red-950 dark:text-red-300">
                restricted by academy
              </span>
            ) : null}
          </div>
          {project.courseName ? (
            <p className="mt-0.5 text-xs text-text-muted">{project.courseName}</p>
          ) : null}
        </div>
        <span className="text-xs text-text-muted">{project.likeCount} like{project.likeCount === 1 ? "" : "s"}</span>
      </div>

      {restricted && project.restrictedReason ? (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {project.restrictedReason}
        </p>
      ) : null}

      {editing ? (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-text-muted">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted">Summary</label>
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted">
              Your notes on the process
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </div>
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const ok = await patch({
                  title,
                  summary,
                  description: description || undefined,
                });
                if (ok) setEditing(false);
              }}
              className="rounded-lg bg-brand-1 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-2 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm text-text-muted">{project.summary}</p>
          {project.description ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{project.description}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || restricted}
              onClick={() => setEditing(true)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-text disabled:opacity-50"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={busy || restricted}
              onClick={() => patch({ featured: !project.featured })}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-text disabled:opacity-50"
            >
              {project.featured ? "Unfeature" : "Feature"}
            </button>
            <button
              type="button"
              disabled={busy || restricted}
              onClick={() =>
                patch({ visibility: project.visibility === "HIDDEN" ? "PUBLISHED" : "HIDDEN" })
              }
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-text disabled:opacity-50"
            >
              {project.visibility === "HIDDEN" ? "Publish" : "Hide"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
            >
              Remove
            </button>
          </div>
        </>
      )}
    </div>
  );
}
