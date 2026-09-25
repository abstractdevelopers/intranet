"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CourseMark } from "@/components/course-mark";
import { IconSpark, IconCheckCircle } from "@/components/icons";
import {
  PROMISE_GOALS,
  PROMISE_GOAL_KEYS,
  STUDIO_BRIEF,
  STUDIO_CRAFT,
  PATHWAY_LABELS,
  PATHWAY_TO_SLUG,
  type Pathway,
} from "@/lib/constants";

/**
 * The studio brief. Two fields that mirror how real work starts: the promise
 * (what you will make) and the deliverable (what you will walk out with).
 * Deliverables are offered as one-tap suggestions from the student's own craft,
 * so nobody faces a blank box — but the field stays free-text.
 */
export function StudioComposer({
  initialBody,
  initialGoal,
  initialAmbition,
  pathway,
  maxLength,
}: {
  initialBody: string | null;
  initialGoal: string | null;
  initialAmbition: string | null;
  pathway: string | null;
  maxLength: number;
}) {
  const router = useRouter();
  const [body, setBody] = useState(initialBody ?? "");
  const [goal, setGoal] = useState<string | null>(initialGoal ?? null);
  const [ambition, setAmbition] = useState(initialAmbition ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const hasPosted = Boolean(initialBody);

  const key = pathway as Pathway | null;
  const craft = key ? STUDIO_CRAFT[key] : null;
  const brief = key ? STUDIO_BRIEF[key] : null;
  const craftLabel = key ? PATHWAY_LABELS[key] : null;

  async function submit() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/student/promises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, goal, ambition }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't save that. Please try again.");
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
    setAmbition("");
    setSaved(false);
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      {/* Craft header — the studio this brief belongs to */}
      <div className="flex items-center gap-3 border-b border-border bg-surface-2 px-5 py-3.5">
        {key ? <CourseMark slug={PATHWAY_TO_SLUG[key]} size="sm" /> : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {craftLabel ? `${craftLabel} studio` : "Your studio"}
          </p>
          <p className="text-[11px] text-text-muted">
            {craft ? `${craft.craft} · ${craft.medium}` : "Choose your pathway to join a studio"}
          </p>
        </div>
      </div>

      <div className="p-5">
        {/* The craft's ethos — why this work matters */}
        {craft ? (
          <p className="mb-5 border-l-2 border-brand-1/40 pl-3 text-sm italic text-text-muted">
            {craft.ethos}
          </p>
        ) : null}

        <label htmlFor="promise" className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          01 — Your promise
        </label>
        <textarea
          id="promise"
          value={body}
          maxLength={maxLength}
          rows={2}
          onChange={(e) => {
            setBody(e.target.value);
            setSaved(false);
          }}
          placeholder={brief?.promise ?? "What I want to make at UCA is…"}
          className="mt-1.5 w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-brand-1"
        />

        <label
          htmlFor="ambition"
          className="mt-5 block text-xs font-semibold uppercase tracking-[0.14em] text-text-muted"
        >
          02 — What you&apos;ll walk out with
        </label>
        <input
          id="ambition"
          value={ambition}
          maxLength={maxLength}
          onChange={(e) => {
            setAmbition(e.target.value);
            setSaved(false);
          }}
          placeholder={brief?.ambition ?? "By the end of term, I'll have made…"}
          className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-brand-1"
        />
        {craft && !ambition ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {craft.deliverables.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setAmbition(d);
                  setSaved(false);
                }}
                className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-text-muted transition-colors hover:border-brand-1/50 hover:text-text"
              >
                {d}
              </button>
            ))}
          </div>
        ) : null}

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          What you&apos;re working toward
        </p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {PROMISE_GOAL_KEYS.map((k) => {
            const active = goal === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setGoal(active ? null : k);
                  setSaved(false);
                }}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-brand-1 bg-brand-1 text-white"
                    : "border-border bg-surface-2 text-text-muted hover:border-brand-1/50 hover:text-text"
                }`}
              >
                {PROMISE_GOALS[k]}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-xs text-text-muted">
            {body.length}/{maxLength}
            {saved ? (
              <span className="ml-2 inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <IconCheckCircle className="h-3.5 w-3.5" />
                On the wall.
              </span>
            ) : null}
          </span>
          <div className="flex items-center gap-2">
            {hasPosted ? (
              <Button variant="ghost" onClick={remove} disabled={busy} type="button">
                Remove
              </Button>
            ) : null}
            <Button onClick={submit} disabled={busy || body.trim().length < 3} type="button">
              <IconSpark className="h-4 w-4" />
              {busy ? "Saving…" : hasPosted ? "Update" : "Add to the wall"}
            </Button>
          </div>
        </div>
        {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      </div>
    </div>
  );
}
