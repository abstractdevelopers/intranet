"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Course = { id: string; name: string; type: string; pathway: string | null };
type Style = { key: string; label: string; description: string; eyebrow: string };
type SavedTemplate = {
  id: string;
  name: string;
  eyebrow: string | null;
  heading: string;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  note: string | null;
  signoff: string | null;
  imageIds: string | null;
  kind: string | null;
};

type Audience = "ALL_STUDENTS" | "SIGNED_UP" | "NOT_SIGNED_UP" | "COURSE" | "PATHWAY";

const AUDIENCE_LABELS: Record<Audience, string> = {
  ALL_STUDENTS: "Everyone",
  SIGNED_UP: "Signed-up students",
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

/** A small starter body so a new campaign never begins completely blank. */
const DRAFT_BODY = `Here's what's happening at Unca Academy this week.

Replace this with your message. Leave a blank line between paragraphs.

Add a link on its own line like this:
Watch the replay: https://intranet.launchverse.site/login`;

export function CampaignComposer({ courses, styles }: { courses: Course[]; styles: Style[] }) {
  const router = useRouter();

  const [styleKey, setStyleKey] = useState(styles[0]?.key ?? "BANNER");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [eyebrow, setEyebrow] = useState(styles[0]?.eyebrow ?? "Academy update");
  const [heading, setHeading] = useState("");
  const [body, setBody] = useState(DRAFT_BODY);
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [note, setNote] = useState("");
  const [signoff, setSignoff] = useState("— The UCA Sandbox team");

  const [images, setImages] = useState<{ id: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  const [audience, setAudience] = useState<Audience>("ALL_STUDENTS");
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [pathway, setPathway] = useState(PATHWAYS[0].value);

  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [saved, setSaved] = useState<SavedTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string>("");

  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [scheduledAt, setScheduledAt] = useState("");
  const [savedTemplateName, setSavedTemplateName] = useState("");
  const previewRef = useRef<HTMLIFrameElement>(null);

  const payload = useMemo(
    () => ({
      title,
      subject,
      eyebrow,
      heading,
      body,
      ctaLabel,
      ctaUrl,
      note,
      signoff,
      templateId: templateId || null,
      imageIds: images.map((i) => i.id),
      style: styleKey,
      audience,
      courseIds,
      pathway: audience === "PATHWAY" ? pathway : null,
    }),
    [title, subject, eyebrow, heading, body, ctaLabel, ctaUrl, note, signoff, templateId, images, styleKey, audience, courseIds, pathway]
  );

  useEffect(() => {
    fetch("/api/admin/email-templates")
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d) => setSaved(d.templates ?? []))
      .catch(() => setSaved([]));
  }, []);

  /** Ask the server how many people the current rules reach. */
  const refreshAudience = useCallback(async () => {
    setAudienceCount(null);
    const res = await fetch("/api/admin/campaigns/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "AUDIENCE", audience, courseIds, pathway }),
    });
    if (res.ok) {
      const data = await res.json();
      setAudienceCount(data.count ?? null);
    }
  }, [audience, courseIds, pathway]);

  useEffect(() => {
    void refreshAudience();
  }, [refreshAudience]);

  /** Render the branded preview, debounced so typing stays smooth. */
  const refreshPreview = useCallback(async () => {
    if (!heading || !body) return;
    const res = await fetch("/api/admin/campaigns/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "PREVIEW", eyebrow, heading, body, ctaLabel, ctaUrl, note, signoff, imageIds: images.map((i) => i.id) }),
    });
    if (res.ok && previewRef.current) {
      previewRef.current.srcdoc = await res.text();
    }
  }, [eyebrow, heading, body, ctaLabel, ctaUrl, note, signoff, images]);

  useEffect(() => {
    const timer = setTimeout(() => void refreshPreview(), 400);
    return () => clearTimeout(timer);
  }, [refreshPreview]);

  function applyStyle(key: string) {
    setStyleKey(key);
    const style = styles.find((s) => s.key === key);
    if (style) setEyebrow(style.eyebrow);
  }

  function applySaved(id: string) {
    setTemplateId(id);
    const t = saved.find((s) => s.id === id);
    if (!t) return;
    setEyebrow(t.eyebrow ?? "");
    setHeading(t.heading);
    setBody(t.body);
    setCtaLabel(t.ctaLabel ?? "");
    setCtaUrl(t.ctaUrl ?? "");
    setNote(t.note ?? "");
    setSignoff(t.signoff ?? "");
    try {
      const ids: string[] = t.imageIds ? JSON.parse(t.imageIds) : [];
      setImages(
        ids.map((id) => ({ id, url: `/api/public/email-assets/${id}` }))
      );
    } catch {
      setImages([]);
    }
    // Restore the card design the template was authored in, so loading it
    // doesn't silently drop back to the banner layout.
    if (t.kind && styles.some((s) => s.key === t.kind)) setStyleKey(t.kind);
  }

  async function uploadImage(file: File) {
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/campaigns/upload", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't upload that image.");
      return;
    }
    setImages((prev) => [...prev, { id: data.id, url: data.url }].slice(0, 4));
  }

  function toggleCourse(id: string) {
    setCourseIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function createCampaign() {
    setError(null);
    setNotice(null);
    if (!title || !subject || !heading || !body) {
      setError("A title, subject, heading and body are all required.");
      return null;
    }
    if (audience === "COURSE" && courseIds.length === 0) {
      setError("Choose at least one course.");
      return null;
    }
    const res = await fetch("/api/admin/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "We couldn't save this campaign.");
      return null;
    }
    return data.id as string;
  }

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
    setBusy(null);
  }

  const saveDraft = () =>
    run("draft", async () => {
      const id = await createCampaign();
      if (!id) return;
      setNotice("Saved as a draft.");
      router.refresh();
    });

  const sendTest = () =>
    run("test", async () => {
      if (!testTo) {
        setError("Enter an address to send the test to.");
        return;
      }
      const id = await createCampaign();
      if (!id) return;
      const res = await fetch(`/api/admin/campaigns/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "We couldn't send that test.");
        return;
      }
      setNotice(`Test sent to ${testTo}. Check the inbox and spam folder.`);
      router.refresh();
    });

  const sendNow = () =>
    run("send", async () => {
      if (!confirm(`Send "${title || "this campaign"}" to ${audienceCount ?? "the selected"} recipients now?`)) return;
      const id = await createCampaign();
      if (!id) return;
      const res = await fetch(`/api/admin/campaigns/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SEND_NOW" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "We couldn't start this send.");
        return;
      }

      // The plan's cron only runs daily, so keep the browser driving the send
      // to completion. Each call sends another slice; we stop on the first
      // error and leave the remainder for the next DRAIN attempt.
      let progress = data.progress as { sent: number; failed: number; remaining: number; done: boolean } | undefined;
      let guard = 0;
      while (progress && !progress.done && guard < 60) {
        guard += 1;
        setNotice(`Sending — ${progress.sent} delivered, ${progress.remaining} to go…`);
        const next = await fetch(`/api/admin/campaigns/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "DRAIN" }),
        });
        if (!next.ok) break;
        const nd = await next.json().catch(() => ({}));
        if (!nd?.progress) break;
        progress = nd.progress;
      }

      if (progress) {
        setNotice(
          progress.done
            ? `Done. ${progress.sent} delivered${progress.failed ? `, ${progress.failed} failed` : ""}.`
            : `Paused after ${progress.sent} sends with ${progress.remaining} left. Press "Resume send" to continue.`
        );
      }
      router.refresh();
    });

  const schedule = () =>
    run("schedule", async () => {
      if (!scheduledAt) {
        setError("Pick a date and time to schedule this campaign.");
        return;
      }
      const id = await createCampaign();
      if (!id) return;
      const res = await fetch(`/api/admin/campaigns/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SCHEDULE", scheduledAt: new Date(scheduledAt).toISOString() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "We couldn't schedule this campaign.");
        return;
      }
      setNotice("Scheduled. It will send in the background at that time.");
      router.refresh();
    });

  const saveTemplate = () =>
    run("template", async () => {
      if (!savedTemplateName || !heading || !body) {
        setError("Give the template a name, and make sure there's a heading and body.");
        return;
      }
      const res = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, name: savedTemplateName, kind: styleKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "We couldn't save that template.");
        return;
      }
      const refreshed = await fetch("/api/admin/email-templates").then((r) => r.json());
      setSaved(refreshed.templates ?? []);
      setSavedTemplateName("");
      setNotice("Template saved for reuse.");
    });

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
      {/* ---------------- Composer ---------------- */}
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold text-text-muted">Start from a style</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {styles.map((s) => (
              <button
                key={s.key}
                type="button"
                title={s.description}
                onClick={() => applyStyle(s.key)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  styleKey === s.key
                    ? "border-brand-1 bg-brand-1 text-white"
                    : "border-border bg-surface text-text-muted hover:border-brand-1/50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {saved.length > 0 ? (
          <Field label="Or load a saved template" htmlFor="cmp-saved">
            <Select id="cmp-saved" value={templateId} onChange={(e) => applySaved(e.target.value)}>
              <option value="">— None —</option>
              {saved.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Internal title" hint="Only staff see this." htmlFor="cmp-title">
            <Input id="cmp-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="October cohort update" />
          </Field>
          <Field label="Email subject" hint="This is what lands in the inbox." htmlFor="cmp-subject">
            <Input id="cmp-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Your October update from UCA" />
          </Field>
        </div>

        <Field label="Eyebrow label" hint="The small uppercase line above the headline." htmlFor="cmp-eyebrow">
          <Input id="cmp-eyebrow" value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} />
        </Field>

        <Field label="Headline" htmlFor="cmp-heading">
          <Input id="cmp-heading" value={heading} onChange={(e) => setHeading(e.target.value)} placeholder="Week one is live" />
        </Field>

        <Field
          label="Message"
          hint='Blank line = new paragraph. Write "Label: https://…" on its own line to add a link.'
          htmlFor="cmp-body"
        >
          <Textarea id="cmp-body" rows={9} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Button label" htmlFor="cmp-ctalabel">
            <Input id="cmp-ctalabel" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Open your portal" />
          </Field>
          <Field label="Button link" htmlFor="cmp-ctaurl">
            <Input id="cmp-ctaurl" type="url" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://intranet.launchverse.site/login" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Muted note (optional)" htmlFor="cmp-note">
            <Input id="cmp-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Need help? Reply to this email." />
          </Field>
          <Field label="Sign-off" htmlFor="cmp-signoff">
            <Input id="cmp-signoff" value={signoff} onChange={(e) => setSignoff(e.target.value)} />
          </Field>
        </div>

        {/* Images */}
        <div>
          <p className="text-sm font-medium">Banner images</p>
          <p className="mt-1 text-xs text-text-muted">
            Up to 4. These appear above your message and are served at public URLs so inboxes can load them.
            Use a wide image (around 1056&nbsp;px across) for best results.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-muted transition-colors hover:border-brand-1 hover:text-brand-1">
              {uploading ? "Uploading…" : "Add image"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadImage(file);
                  e.target.value = "";
                }}
              />
            </label>
            {images.map((img) => (
              <span key={img.id} className="inline-flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-10 w-20 rounded object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((i) => i.id !== img.id))}
                  className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                >
                  Remove
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Audience */}
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
                  <input type="checkbox" checked={courseIds.includes(c.id)} onChange={() => toggleCourse(c.id)} />
                  <span>{c.name}</span>
                  <span className="text-xs text-text-muted">{c.type === "ELECTIVE" ? "elective" : "compulsory"}</span>
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
            {audienceCount === null ? (
              "Counting recipients…"
            ) : (
              <>
                Reaches <span className="font-semibold text-text">{audienceCount}</span> student
                {audienceCount === 1 ? "" : "s"}. People who unsubscribed are always excluded.
              </>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-4 rounded-xl border border-border bg-surface-2 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Send a test to" htmlFor="cmp-testto">
              <Input id="cmp-testto" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@launchverse.space" />
            </Field>
            <Field label="Schedule for" htmlFor="cmp-schedule">
              <Input id="cmp-schedule" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={saveDraft} disabled={busy !== null}>
              {busy === "draft" ? "Saving…" : "Save draft"}
            </Button>
            <Button type="button" variant="secondary" onClick={sendTest} disabled={busy !== null}>
              {busy === "test" ? "Sending…" : "Send test"}
            </Button>
            <Button type="button" variant="secondary" onClick={schedule} disabled={busy !== null}>
              {busy === "schedule" ? "Scheduling…" : "Schedule"}
            </Button>
            <Button type="button" onClick={sendNow} disabled={busy !== null}>
              {busy === "send" ? "Starting…" : "Send now"}
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
            <div className="min-w-48 flex-1">
              <Field label="Save these contents as a template" htmlFor="cmp-tplname">
                <Input id="cmp-tplname" value={savedTemplateName} onChange={(e) => setSavedTemplateName(e.target.value)} placeholder="Monthly update" />
              </Field>
            </div>
            <Button type="button" variant="ghost" onClick={saveTemplate} disabled={busy !== null}>
              {busy === "template" ? "Saving…" : "Save template"}
            </Button>
          </div>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
            {notice}
          </p>
        ) : null}
      </div>

      {/* ---------------- Live preview ---------------- */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Live preview</p>
          <Badge tone="brand">{styleKey.toLowerCase().replaceAll("_", " ")}</Badge>
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-white">
          <iframe
            ref={previewRef}
            title="Campaign preview"
            className="h-[720px] w-full"
            sandbox=""
          />
        </div>
        <p className="mt-2 text-xs text-text-muted">
          This is the real email. Check the test send in a few inboxes before a campaign goes out —
          dark mode and mobile especially.
        </p>
      </div>
    </div>
  );
}