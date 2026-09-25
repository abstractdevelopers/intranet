"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { IconMegaphone } from "@/components/icons";

type Course = { id: string; name: string; type: string };

type Audience =
  | "ALL_STUDENTS"
  | "SIGNED_UP"
  | "SIGNED_UP_NO_COURSE"
  | "ELECTIVE"
  | "NOT_SIGNED_UP"
  | "COURSE"
  | "PATHWAY";

const AUDIENCE_LABELS: Record<Audience, string> = {
  ALL_STUDENTS: "Everyone",
  SIGNED_UP: "Signed-up students",
  SIGNED_UP_NO_COURSE: "Signed up, no course",
  ELECTIVE: "On an elective course",
  NOT_SIGNED_UP: "Waiting list (not signed up)",
  COURSE: "By course",
  PATHWAY: "By elective pathway",
};

const PATHWAYS = [
  { value: "GRAPHIC_DESIGN", label: "Graphics Design" },
  { value: "VIDEO_EDITING", label: "Video Editing" },
  { value: "COMMUNICATION_INFLUENCE", label: "Communication & Influence" },
  { value: "CONTENT_WRITING", label: "Content Writing" },
];

/** Compose and send a browser push to a chosen audience. */
export function PushComposer({ courses }: { courses: Course[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [alsoInApp, setAlsoInApp] = useState(true);
  const [audience, setAudience] = useState<Audience>("SIGNED_UP");
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [pathway, setPathway] = useState(PATHWAYS[0].value);

  const [reach, setReach] = useState<{ subscribed: number; audienceSize: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Defer the reset past the effect body: a synchronous setState here would
    // trigger a cascading render.
    const t = setTimeout(() => {
      if (!cancelled) setReach(null);
    }, 0);
    fetch("/api/admin/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "AUDIENCE", audience, courseIds, pathway }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setReach({ subscribed: data.count ?? 0, audienceSize: data.audienceSize ?? 0 });
        }
      })
      .catch(() => {
        if (!cancelled) setReach(null);
      });
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [audience, courseIds, pathway]);

  function toggleCourse(id: string) {
    setCourseIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function send() {
    setError(null);
    setNotice(null);
    if (audience === "COURSE" && courseIds.length === 0) {
      setError("Choose at least one course.");
      return;
    }
    if (!confirm(`Send this push to ${reach?.subscribed ?? "the selected"} subscribed student(s)?`)) {
      return;
    }
    setBusy("send");
    const res = await fetch("/api/admin/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "SEND",
        title,
        body,
        url: url || null,
        alsoInApp,
        audience,
        courseIds,
        pathway: audience === "PATHWAY" ? pathway : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "We couldn't send that. Please try again.");
      return;
    }
    setNotice(`Sent to ${data.sent} device${data.sent === 1 ? "" : "s"}.`);
    setTitle("");
    setBody("");
    setUrl("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="push-title">
          <Input
            id="push-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="New week is live"
          />
        </Field>
        <Field label="Message" htmlFor="push-body">
          <Input
            id="push-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={400}
            placeholder="Week 3 of Personal Branding is now open."
          />
        </Field>
      </div>

      <Field label="Opens (optional)" htmlFor="push-url" hint="Where a tap lands. Defaults to notifications.">
        <Input
          id="push-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="/student/courses"
        />
      </Field>

      <div className="rounded-xl border border-border bg-surface-2 p-4">
        <p className="text-sm font-semibold">Audience</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(AUDIENCE_LABELS) as Audience[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setAudience(key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                audience === key
                  ? "border-brand-1 bg-brand-1 text-white"
                  : "border-border bg-surface text-text-muted hover:border-brand-1/50"
              }`}
            >
              {AUDIENCE_LABELS[key]}
            </button>
          ))}
        </div>

        {audience === "COURSE" ? (
          <div className="mt-3 space-y-1.5">
            {courses.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={courseIds.includes(c.id)}
                  onChange={() => toggleCourse(c.id)}
                />
                <span>{c.name}</span>
                <span className="text-xs text-text-muted">
                  {c.type === "ELECTIVE" ? "elective" : "compulsory"}
                </span>
              </label>
            ))}
          </div>
        ) : null}

        {audience === "PATHWAY" ? (
          <div className="mt-3">
            <Select value={pathway} onChange={(e) => setPathway(e.target.value)}>
              {PATHWAYS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        <p className="mt-3 text-xs text-text-muted">
          {reach === null ? (
            "Counting recipients…"
          ) : (
            <>
              <span className="font-semibold text-text">{reach.subscribed}</span> subscribed on this
              audience of {reach.audienceSize}. Students without notifications enabled still get an
              in-app notification if you keep that on.
            </>
          )}
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={alsoInApp} onChange={(e) => setAlsoInApp(e.target.checked)} />
        Also send an in-app notification
      </label>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          {notice}
        </p>
      ) : null}

      <Button type="button" onClick={send} disabled={busy === "send" || !title || !body}>
        <IconMegaphone className="h-4 w-4" />
        {busy === "send" ? "Sending…" : "Send push"}
      </Button>
    </div>
  );
}
