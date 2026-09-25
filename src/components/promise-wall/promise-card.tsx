import Link from "next/link";
import { Avatar } from "@/components/creators/avatar";
import { EliteBadge } from "@/components/elite-badge";
import { VerificationBadge } from "@/components/verification-badge";
import { FollowButton } from "@/components/creators/follow-button";
import { CheerButton } from "@/components/promise-wall/cheer-button";
import { Badge } from "@/components/ui/badge";
import { goalLabel, type WallEntry } from "@/lib/promises";
import { PATHWAY_LABELS, PATHWAY_TONES, type Pathway } from "@/lib/constants";

/** How long ago, in the compact "3h" style used across the portal. */
function shortAgo(date: Date) {
  const mins = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/**
 * One creator statement. Shows who said it, their craft and goal, their line,
 * a follow button and a cheer — the two ways to react to someone on the wall.
 */
export function PromiseCard({ entry }: { entry: WallEntry }) {
  const goal = goalLabel(entry.goal);
  const craft = entry.pathway ? PATHWAY_LABELS[entry.pathway as Pathway] ?? entry.pathway : null;
  const craftTone = entry.pathway
    ? PATHWAY_TONES[entry.pathway as Pathway]
    : "bg-surface-2 text-text-muted";

  return (
    <article className="flex flex-col rounded-2xl border border-border bg-surface p-5">
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
        {entry.isOwn ? (
          <Badge tone="brand">You</Badge>
        ) : (
          <FollowButton userId={entry.author.id} initialFollowing={entry.isFollowing} size="sm" />
        )}
      </div>

      {(craft || goal) ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {craft ? (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${craftTone}`}>
              {craft}
            </span>
          ) : null}
          {goal ? <span className="text-xs font-medium text-text-muted">{goal}</span> : null}
        </div>
      ) : null}

      <p className="mt-3 flex-1 text-sm leading-relaxed">{entry.body}</p>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <CheerButton
          promiseId={entry.id}
          initialCount={entry.cheerCount}
          initialCheered={entry.cheeredByViewer}
        />
      </div>
    </article>
  );
}
