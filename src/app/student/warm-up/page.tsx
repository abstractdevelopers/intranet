import Link from "next/link";
import { requireStudent } from "@/lib/rbac";
import { EmptyState } from "@/components/ui/empty";
import { StudioComposer } from "@/components/promise-wall/studio-composer";
import { StudioCard } from "@/components/promise-wall/studio-card";
import { StudioStandings } from "@/components/promise-wall/studio-standings";
import {
  getWall,
  getMyPromise,
  getWallCount,
  getCraftCounts,
  getCheersByPathway,
  rankStudios,
  getViewerPathway,
  PROMISE_MAX_LENGTH,
} from "@/lib/promises";
import {
  isPromiseWallOpen,
  CLASSES_START,
  PATHWAY_LABELS,
  PATHWAYS,
  PATHWAY_TONES,
  STUDIO_CRAFT,
  type Pathway,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Studio Wall" };

/**
 * The Studio Wall — the academy's pre-class declaration.
 *
 * Each of the four studios declares what it will make. A student posts the work
 * they promise to produce and the deliverable they'll walk out with, tagged to
 * their craft. The wall is therefore tied to the curriculum: it shows what the
 * academy actually teaches, in the students' own words, and lets each studio
 * see itself forming before day one.
 */
export default async function StudioWallPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const user = await requireStudent();
  const { course = "" } = await searchParams;

  const viewerPathway = await getViewerPathway(user.id);
  const courseFilter = Object.keys(PATHWAYS).includes(course) ? course : "";

  const [entries, mine, count, craftCounts, cheersByPathway] = await Promise.all([
    getWall(user.id, { pathway: courseFilter || null }),
    getMyPromise(user.id),
    getWallCount(),
    getCraftCounts(),
    getCheersByPathway(),
  ]);
  const standings = rankStudios(craftCounts, cheersByPathway);

  const open = isPromiseWallOpen();
  const craftKeys = Object.keys(PATHWAYS) as Pathway[];
  const viewerCraft = viewerPathway ? STUDIO_CRAFT[viewerPathway as Pathway] : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Editorial hero */}
      <div className="hero-band relative overflow-hidden rounded-2xl p-6 md:p-8">
        <p className="hero-eyebrow text-[11px] font-semibold uppercase tracking-[0.18em]">
          UCA Sandbox · Before classes begin
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">
          The Studio Wall
        </h1>
        <p className="hero-muted mt-2 max-w-2xl text-sm">
          Four studios, one academy. Declare the work you&apos;ll make and the deliverable
          you&apos;ll walk out with — then read what everyone else is building. Classes begin{" "}
          {formatDate(CLASSES_START)}.
        </p>
      </div>

      {/* The brief */}
      <div>
        {open ? (
          <StudioComposer
            initialBody={mine?.body ?? null}
            initialGoal={mine?.goal ?? null}
            initialAmbition={mine?.ambition ?? null}
            pathway={(mine?.pathway ?? viewerPathway) || null}
            maxLength={PROMISE_MAX_LENGTH}
          />
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-text-muted">
            The wall closed to new declarations when classes began — every card below stays.{" "}
            {mine ? "Yours is still here." : ""}
          </div>
        )}
      </div>

      {/* The four studios */}
      <StudioStandings standings={standings} viewerPathway={viewerPathway} />

      {/* Studio filter */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/student/warm-up"
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            courseFilter
              ? "border-border bg-surface-2 text-text-muted hover:text-text"
              : "border-brand-1 bg-brand-1 text-white"
          }`}
        >
          All studios ({count})
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

      {/* The wall */}
      {entries.length === 0 ? (
        <EmptyState
          title={
            courseFilter
              ? `No ${PATHWAY_LABELS[courseFilter as Pathway]} declarations yet`
              : "The wall is empty — declare first"
          }
          body={
            courseFilter
              ? "Be the first from your studio to put your work on the wall."
              : "Add your promise above and it appears here for the whole academy."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {entries.map((entry) => (
            <StudioCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {viewerCraft ? (
        <p className="text-center text-xs text-text-muted">
          Your studio works in {viewerCraft.medium.toLowerCase()}. Ready to share work and get
          feedback?{" "}
          <Link href="/student/peer-body" className="text-brand-1 hover:underline dark:text-brand-3">
            Open Peer Body
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
