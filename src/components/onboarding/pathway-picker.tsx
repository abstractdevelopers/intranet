"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CourseMark } from "@/components/course-mark";
import { EliteBadge } from "@/components/elite-badge";
import { IconCheckCircle } from "@/components/icons";
import { ELITE_BADGE_LIMIT } from "@/lib/constants";

type Course = {
  id: string;
  name: string;
  description: string;
  slug: string;
  price: number;
};

/**
 * One-click pathway choice for returning creators. Selecting a card is the
 * whole interaction — no forms, no waiting for approval. The server re-checks
 * the time-boxed allowance, so this stays a convenience only.
 */
export function PathwayPicker({ courses }: { courses: Course[] }) {
  const router = useRouter();
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elite, setElite] = useState<number | null>(null);

  async function choose(courseId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setChosen(courseId);

    const res = await fetch("/api/onboarding/pathway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ electiveCourseId: courseId }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setBusy(false);
      setChosen(null);
      setError(data.error ?? "We couldn't set your pathway. Please try again.");
      return;
    }

    // Celebrate the Elite rank in place, then hand off to the dashboard.
    if (data.eliteMemberNumber) {
      setElite(data.eliteMemberNumber);
      await new Promise((r) => setTimeout(r, 2200));
    }
    router.push(data.redirect ?? "/student");
  }

  if (elite) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-brand-1/30 bg-brand-1/5 px-6 py-12 text-center">
        <EliteBadge memberNumber={elite} className="h-12 w-12" />
        <p className="mt-4 text-lg font-bold tracking-tight">You&apos;re an Elite Member</p>
        <p className="mt-1 text-sm text-text-muted">
          Badge&nbsp;#{elite} of {ELITE_BADGE_LIMIT} — carried on your profile from now on.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Choose your pathway">
        {courses.map((course) => {
          const active = chosen === course.id;
          return (
            <button
              key={course.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={busy}
              onClick={() => choose(course.id)}
              className={`group flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors disabled:cursor-wait ${
                active
                  ? "border-brand-1 bg-brand-1/5"
                  : "border-border bg-surface hover:border-brand-1/40 hover:bg-surface-2"
              }`}
            >
              <CourseMark slug={course.slug} size="md" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{course.name}</span>
                  {active ? (
                    <IconCheckCircle className="h-4 w-4 shrink-0 text-brand-1 dark:text-brand-3" />
                  ) : null}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-text-muted">
                  {course.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {busy ? (
        <p className="text-sm text-text-muted" role="status">
          Setting up your pathway…
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
