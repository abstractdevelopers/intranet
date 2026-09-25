import Link from "next/link";
import { CourseMark } from "@/components/course-mark";
import { STUDIO_CRAFT, PATHWAY_LABELS, PATHWAY_TO_SLUG, type Pathway } from "@/lib/constants";

/**
 * The four studios, side by side.
 *
 * Every craft has the same number of students, so this is a fair race — each
 * studio can win it, unlike a global leaderboard where the biggest group always
 * wins. It counts what the academy actually cares about: how many people have
 * declared their work, and how much support it drew. No points, no streaks.
 */
export function StudioStandings({
  standings,
  viewerPathway,
}: {
  standings: { pathway: string; promises: number; cheers: number }[];
  viewerPathway: string | null;
}) {
  const leader = standings.find((s) => s.promises > 0);

  return (
    <section aria-label="Studio standings" className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow text-xs font-semibold">The four studios</p>
        <p className="text-xs text-text-muted">
          {leader
            ? `${PATHWAY_LABELS[leader.pathway as Pathway]} is leading the wall`
            : "Nobody has declared their work yet"}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {standings.map((s) => {
          const key = s.pathway as Pathway;
          const craft = STUDIO_CRAFT[key];
          const mine = s.pathway === viewerPathway;
          const leading = leader?.pathway === s.pathway;
          return (
            <Link
              key={s.pathway}
              href={`/student/warm-up?course=${s.pathway}`}
              className={`group rounded-xl border p-4 transition-colors ${
                mine
                  ? "border-brand-1/50 bg-brand-1/5"
                  : "border-border bg-surface-2 hover:border-brand-1/30"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CourseMark slug={PATHWAY_TO_SLUG[key]} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {PATHWAY_LABELS[key]}
                    {mine ? <span className="text-brand-1 dark:text-brand-3"> · you</span> : null}
                  </p>
                  <p className="truncate text-[11px] text-text-muted">{craft.craft}</p>
                </div>
                {leading ? (
                  <span className="shrink-0 rounded-full bg-brand-1/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-1 dark:text-brand-3">
                    Leading
                  </span>
                ) : null}
              </div>

              <p className="mt-3 text-xs text-text-muted">{craft.medium}</p>

              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-lg font-bold">{s.promises}</span>
                <span className="text-[11px] text-text-muted">
                  declared · {s.cheers} cheer{s.cheers === 1 ? "" : "s"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
