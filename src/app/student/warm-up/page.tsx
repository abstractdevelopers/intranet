import Link from "next/link";
import { requireStudent } from "@/lib/rbac";
import { EmptyState } from "@/components/ui/empty";
import { PromiseComposer } from "@/components/promise-wall/promise-composer";
import { PromiseCard } from "@/components/promise-wall/promise-card";
import {
  getWall,
  getMyPromise,
  getWallCount,
  getCraftCounts,
  getViewerPathway,
  PROMISE_MAX_LENGTH,
} from "@/lib/promises";
import {
  isPromiseWallOpen,
  CLASSES_START,
  PATHWAY_LABELS,
  PATHWAYS,
  PATHWAY_TONES,
  PROMISE_PROMPTS,
  PROMISE_PROMPTS_BY_PATHWAY,
  type Pathway,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Warm-up" };

/**
 * The course warm-up before classes begin. Every student writes one line for
 * their craft — a small, real first thought — and can see what everyone else
 * wrote. Filtered by course so it reads as four groups getting started, not a
 * competition.
 */
export default async function WarmUpPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const user = await requireStudent();
  const { course = "" } = await searchParams;

  const viewerPathway = await getViewerPathway(user.id);
  const courseFilter = Object.keys(PATHWAYS).includes(course) ? course : "";

  const [entries, mine, count, craftCounts] = await Promise.all([
    getWall(user.id, { pathway: courseFilter || null }),
    getMyPromise(user.id),
    getWallCount(),
    getCraftCounts(),
  ]);

  const open = isPromiseWallOpen();

  // Prompts are written for the student's course when we know it.
  const paths = viewerPathway
    ? PROMISE_PROMPTS_BY_PATHWAY[viewerPathway as Pathway]
    : [...PROMISE_PROMPTS];
  const prompt = paths[count % paths.length] ?? paths[0];

  const craftKeys = Object.keys(PATHWAYS) as Pathway[];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="hero-band relative overflow-hidden rounded-2xl p-6 md:p-8">
        <p className="hero-eyebrow text-[11px] font-semibold uppercase tracking-[0.18em]">
          Before classes begin
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">
          Your first warm-up
        </h1>
        <p className="hero-muted mt-2 max-w-2xl text-sm">
          A small first task to get your craft moving before term. Write one line for your course,
          and read what your coursemates are working toward. Nothing here is graded — it&apos;s how
          we begin as creators. Classes begin {formatDate(CLASSES_START)}.
        </p>
      </div>

      <div className="mt-6">
        {open ? (
          <PromiseComposer
            initialBody={mine?.body ?? null}
            initialGoal={mine?.goal ?? null}
            paths={paths}
            prompt={prompt}
            pathway={(mine?.pathway ?? viewerPathway) || null}
            maxLength={PROMISE_MAX_LENGTH}
          />
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-text-muted">
            This warm-up closed when classes began — but every line below stays.{" "}
            {mine ? "Yours is still here." : ""}
          </div>
        )}
      </div>

      {/* Course filters — see your coursemates at a glance */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/student/warm-up"
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            courseFilter
              ? "border-border bg-surface-2 text-text-muted hover:text-text"
              : "border-brand-1 bg-brand-1 text-white"
          }`}
        >
          Everyone ({count})
        </Link>
        {craftKeys.map((key) => {
          const n = craftCounts[key] ?? 0;
          const active = courseFilter === key;
          return (
            <Link
              key={key}
              href={`/student/warm-up?course=${key}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? `border-transparent ${PATHWAY_TONES[key]} ring-1 ring-brand-1`
                  : "border-border bg-surface-2 text-text-muted hover:text-text"
              }`}
            >
              {PATHWAY_LABELS[key]} ({n})
            </Link>
          );
        })}
      </div>

      <div className="mt-6">
        {entries.length === 0 ? (
          <EmptyState
            title={
              courseFilter ? "No one from this course has started yet" : "No one has started yet — go first"
            }
            body={
              courseFilter
                ? "Try another course, or be the first from yours to write your line."
                : "Write your line above and it'll appear here for everyone."
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {entries.map((entry) => (
              <PromiseCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      <p className="mt-8 text-center text-xs text-text-muted">
        Ready to share work and get feedback from your coursemates?{" "}
        <Link href="/student/peer-body" className="text-brand-1 hover:underline dark:text-brand-3">
          Open Peer Body
        </Link>
        .
      </p>
    </div>
  );
}
