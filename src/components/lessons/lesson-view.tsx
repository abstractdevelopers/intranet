"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck, IconCheckCircle, IconClock, IconFile } from "@/components/icons";

type Resource = {
  id: string;
  title: string;
  type: string;
  url: string | null;
  documentId: string | null;
};

export function LessonView({
  lessonId,
  content,
  youtubeVideoId,
  resources,
  initialCompleted,
  nextLessonHref,
}: {
  lessonId: string;
  content: string | null;
  youtubeVideoId: string | null;
  resources: Resource[];
  initialCompleted: boolean;
  nextLessonHref: string | null;
}) {
  const router = useRouter();
  const [completed, setCompleted] = useState(initialCompleted);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/student/lessons/${lessonId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "OPEN" }),
    });
  }, [lessonId]);

  async function complete() {
    setSaving(true);
    const res = await fetch(`/api/student/lessons/${lessonId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "COMPLETE" }),
    });
    setSaving(false);
    if (res.ok) {
      setCompleted(true);
      router.refresh();
      if (nextLessonHref) router.push(nextLessonHref);
    }
  }

  return (
    <div className="space-y-6">
      {youtubeVideoId ? (
        <div className="overflow-hidden rounded-xl border border-border bg-ink">
          <div className="relative aspect-video">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}?rel=0`}
              title="Lesson video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </div>
      ) : null}

      {content ? (
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="whitespace-pre-wrap text-sm leading-7 text-text">{content}</div>
        </div>
      ) : null}

      {resources.length > 0 ? (
        <section>
          <p className="eyebrow">Resources</p>
          <ul className="mt-3 space-y-2">
            {resources.map((r) => {
              const href =
                r.type === "PDF" && r.documentId ? `/api/documents/${r.documentId}` : (r.url ?? "#");
              return (
                <li key={r.id}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-brand-1/40"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-3/25 text-brand-1 dark:text-brand-3">
                      <IconFile className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-sm font-medium">{r.title}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                      {r.type}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
        {completed ? (
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-success">
            <IconCheckCircle className="h-5 w-5" /> Completed
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 text-sm text-text-muted">
            <IconClock className="h-4 w-4" /> Mark complete when you&rsquo;re done
          </span>
        )}
        <button
          onClick={complete}
          disabled={completed || saving}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-1 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
        >
          <IconCheck className="h-4 w-4" />
          {saving ? "Saving…" : completed ? "Completed" : nextLessonHref ? "Complete & continue" : "Mark complete"}
        </button>
      </div>
    </div>
  );
}
