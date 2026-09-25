"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconSpark } from "@/components/icons";
import { PROMISE_GOALS, PROMISE_GOAL_KEYS, PATHWAY_LABELS, type Pathway } from "@/lib/constants";

/**
 * The composer for the viewer's creator statement. One line plus a goal — the
 * craft chip is shown read-only because it comes from their elective. Once
 * posted, the same control edits or removes it.
 */
export function PromiseComposer({
  initialBody,
  initialGoal,
  paths,
  prompt,
  pathway,
  maxLength,
}: {
  initialBody: string | null;
  initialGoal: string | null;
  /** Craft prompts, cycled by "give me another". */
  paths: string[];
  prompt: string;
  pathway: string | null;
  maxLength: number;
}) {
  const router = useRouter();
  const [body, setBody] = useState(initialBody ?? "");
  const [goal, setGoal] = useState<string | null>(initialGoal ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [promptIdx, setPromptIdx] = useState(0);
  const hasPosted = Boolean(initialBody);

  const activePrompt = paths[promptIdx % paths.length] ?? prompt;
  const craftLabel = pathway ? PATHWAY_LABELS[pathway as Pathway] ?? pathway : null;

  async function submit() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/student/promises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, goal }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't post that. Please try again.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/student/promises", { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("We couldn't remove that. Please try again.");
      return;
    }
    setBody("");
    setGoal(null);
    setSaved(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="promise" className="text-sm font-semibold">
          {hasPosted ? "Your line" : "Your warm-up"}
        </label>
        {craftLabel ? (
          <span className="text-xs text-text-muted">
            You&apos;re on <span className="font-semibold text-text">{craftLabel}</span>
          </span>
        ) : null}
      </div>

      <textarea
        id="promise"
        value={body}
        maxLength={maxLength}
        rows={2}
        onChange={(e) => {
          setBody(e.target.value);
          setSaved(false);
        }}
        placeholder={hasPosted ? "" : activePrompt}
        className="mt-2 w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-brand-1"
      />

      {!hasPosted && paths.length > 1 ? (
        <button
          type="button"
          onClick={() => setPromptIdx((i) => i + 1)}
          className="mt-1 text-xs text-brand-1 hover:underline dark:text-brand-3"
        >
          Give me another
        </button>
      ) : null}

      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
        What are you working toward?
      </p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {PROMISE_GOAL_KEYS.map((key) => {
          const active = goal === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setGoal(active ? null : key);
                setSaved(false);
              }}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-brand-1 bg-brand-1 text-white"
                  : "border-border bg-surface-2 text-text-muted hover:border-brand-1/50 hover:text-text"
              }`}
            >
              {PROMISE_GOALS[key]}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs text-text-muted">
          {body.length}/{maxLength}
          {saved ? <span className="ml-2 text-emerald-600 dark:text-emerald-400">Posted.</span> : null}
        </span>
        <div className="flex items-center gap-2">
          {hasPosted && body.trim().length > 0 ? (
            <Button variant="ghost" onClick={remove} disabled={busy} type="button">
              Remove
            </Button>
          ) : null}
          <Button onClick={submit} disabled={busy || body.trim().length < 3} type="button">
            <IconSpark className="h-4 w-4" />
            {busy ? "Saving…" : hasPosted ? "Update" : "Post my line"}
          </Button>
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
