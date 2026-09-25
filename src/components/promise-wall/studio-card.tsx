import Link from "next/link";
import { Avatar } from "@/components/creators/avatar";
import { EliteBadge } from "@/components/elite-badge";
import { VerificationBadge } from "@/components/verification-badge";
import { FollowButton } from "@/components/creators/follow-button";
import { CheerButton } from "@/components/promise-wall/cheer-button";
import { CourseMark } from "@/components/course-mark";
import { goalLabel, type WallEntry } from "@/lib/promises";
import { STUDIO_CRAFT, PATHWAY_LABELS, PATHWAY_TO_SLUG, type Pathway } from "@/lib/constants";

/** How long ago, in the compact "3h" style used across the portal. */
function shortAgo(date: Date) {
  const mins = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/**
 * One creator's studio card. Two halves: the promise (what they will make) and
 * the deliverable (what they will walk out with). The craft strip at the top
 * ties it to a real course, so the wall reads as four studios at work rather
 * than a feed of posts.
 */
export function StudioCard({ entry }: { entry: WallEntry }) {
  const goal = goalLabel(entry.goal);
  const craft = entry.pathway ? STUDIO_CRAFT[entry.pathway as Pathway] : null;
  const craftLabel = entry.pathway
    ? PATHWAY_LABELS[entry.pathway as Pathway] ?? entry.pathway
    : null;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
      {/* Craft strip — the course this work belongs to */}
      <div className="flex items-center gap-2.5 border-b border-border bg-surface-2 px-5 py-3">
        {entry.pathway ? (
          <CourseMark slug={PATHWAY_TO_SLUG[entry.pathway as Pathway]} size="sm" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">{craftLabel ?? "No craft yet"}</p>
          <p className="truncate text-[11px] text-text-muted">{craft?.craft ?? "Studio"}</p>
        </div>
        {goal ? (
          <span className="hidden shrink-0 text-[11px] font-medium text-text-muted sm:block">
            {goal}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3">
          <Avatar documentId={entry.author.avatarDocumentId} name={entry.author.fullName} />
          <div className="min-w-0 flex-1">
            <Link
              href={`/student/creators/${entry.author.username ?? entry.author.id}`}
              className="flex items-center gap-1 text-sm font-semibold hover:text-brand-1 dark:hover:text-brand-3"
            >
              <span className="truncate">{entry.author.fullName}</span>
              <EliteBadge memberNumber={entry.author.eliteMemberNumber} />
              <VerificationBadge tier={entry.author.verificationTier} />
            </Link>
            <p className="truncate text-xs text-text-muted">
              {entry.author.username ? `@${entry.author.username} · ` : ""}
              {shortAgo(entry.createdAt)}
            </p>
          </div>
          {entry.isOwn ? null : (
            <FollowButton userId={entry.author.id} initialFollowing={entry.isFollowing} size="sm" />
          )}
        </div>

        {/* The promise */}
        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            I promise
          </p>
          <p className="mt-1 text-sm leading-relaxed">{entry.body}</p>
        </div>

        {/* The deliverable */}
        {entry.ambition ? (
          <div className="mt-3 rounded-lg border border-brand-1/25 bg-brand-1/5 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-1 dark:text-brand-3">
              I&apos;ll walk out with
            </p>
            <p className="mt-1 text-sm leading-relaxed">{entry.ambition}</p>
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between border-t border-border pt-3 mt-4">
          <CheerButton
            promiseId={entry.id}
            initialCount={entry.cheerCount}
            initialCheered={entry.cheeredByViewer}
          />
        </div>
      </div>
    </article>
  );
}
