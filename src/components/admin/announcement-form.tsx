"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AnnouncementForm({ courses }: { courses: { id: string; name: string }[] }) {
  const router = useRouter();
  const [audience, setAudience] = useState<"ACADEMY" | "COURSE">("ACADEMY");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body,
        audience,
        courseId: audience === "COURSE" ? courseId : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't complete that action. Please try again.");
      return;
    }
    setTitle("");
    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={publish} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAudience("ACADEMY")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
            audience === "ACADEMY"
              ? "border-brand-1 bg-brand-1 text-white"
              : "border-border bg-surface text-text-muted"
          }`}
        >
          Entire academy
        </button>
        <button
          type="button"
          onClick={() => setAudience("COURSE")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
            audience === "COURSE"
              ? "border-brand-1 bg-brand-1 text-white"
              : "border-border bg-surface text-text-muted"
          }`}
        >
          Specific course
        </button>
      </div>

      {audience === "COURSE" ? (
        <div>
          <label htmlFor="ann-course" className="block text-xs font-semibold text-text-muted">
            Course
          </label>
          <select
            id="ann-course"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label htmlFor="ann-title" className="block text-xs font-semibold text-text-muted">
          Title
        </label>
        <input
          id="ann-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="ann-body" className="block text-xs font-semibold text-text-muted">
          Announcement
        </label>
        <textarea
          id="ann-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={5}
          className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>

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
        {busy ? "Publishing…" : "Publish announcement"}
      </button>
    </form>
  );
}
