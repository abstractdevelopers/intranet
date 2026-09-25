import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/creators/avatar";
import { VerificationBadge } from "@/components/verification-badge";
import { EliteBadge } from "@/components/elite-badge";
import { FollowButton } from "@/components/creators/follow-button";
import { IconCourses, IconUsers } from "@/components/icons";
import type { CreatorCard as CreatorCardData } from "@/lib/creators";

/**
 * A single creator tile, shared by the Discover, Following and Followers views.
 * `viewerId` lets the card show "this is you" instead of a follow button.
 */
export function CreatorCard({
  creator,
  viewerId,
}: {
  creator: CreatorCardData;
  viewerId: string;
}) {
  const isSelf = creator.id === viewerId;

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start gap-3">
        <Avatar documentId={creator.avatarDocumentId} name={creator.fullName} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/student/creators/${creator.username ?? creator.id}`}
            className="flex items-center gap-1 text-sm font-semibold hover:text-brand-1 dark:hover:text-brand-3"
          >
            <span className="truncate">{creator.fullName}</span>
            <EliteBadge memberNumber={creator.eliteMemberNumber} />
            <VerificationBadge tier={creator.verificationTier} />
          </Link>
          {creator.username ? (
            <p className="truncate text-xs text-text-muted">@{creator.username}</p>
          ) : null}
        </div>
      </div>

      {creator.headline ? (
        <p className="mt-3 flex-1 text-sm text-text-muted">{creator.headline}</p>
      ) : (
        <p className="mt-3 flex-1 text-sm text-text-muted opacity-60">No headline yet.</p>
      )}

      {creator.pathwayLabel ? (
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-text-muted">
          {creator.pathwayLabel}
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
        <span className="inline-flex items-center gap-1">
          <IconCourses className="h-3.5 w-3.5" />
          {creator.projectCount} project{creator.projectCount === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-1">
          <IconUsers className="h-3.5 w-3.5" />
          {creator.followerCount} follower{creator.followerCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {isSelf ? (
          <Link
            href="/student/profile"
            className="text-xs font-semibold text-brand-1 hover:underline dark:text-brand-3"
          >
            This is you — edit your profile
          </Link>
        ) : (
          <>
            <FollowButton
              userId={creator.id}
              initialFollowing={creator.isFollowing}
              followsYou={creator.isFollowedBy}
              size="sm"
            />
            {!creator.isFollowing && creator.isFollowedBy ? (
              <span className="text-xs font-medium text-text-muted">Follows you</span>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}
