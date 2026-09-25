import { db } from "./db";
import { PUBLIC_PROJECT_VISIBILITY } from "./projects";
import { PATHWAY_LABELS, type Pathway } from "./constants";

export type CreatorCard = {
  id: string;
  username: string | null;
  fullName: string;
  headline: string | null;
  avatarDocumentId: string | null;
  pathway: string | null;
  pathwayLabel: string | null;
  projectCount: number;
  followerCount: number;
  isFollowing: boolean;
  isFollowedBy: boolean;
  verificationTier: string | null;
};

/** Shape shared by every creator query so one mapper covers all of them. */
type CreatorRow = {
  id: string;
  username: string | null;
  verificationTier: string | null;
  profile: { fullName: string; headline: string | null; avatarDocumentId: string | null } | null;
  enrollments: { pathway: string | null }[];
  _count: { projects: number; followers: number };
};

function toCreatorCard(
  c: CreatorRow,
  opts: { isFollowing: boolean; isFollowedBy: boolean }
): CreatorCard {
  const pathway = c.enrollments[0]?.pathway ?? null;
  return {
    id: c.id,
    username: c.username,
    fullName: c.profile?.fullName ?? "UCA student",
    headline: c.profile?.headline ?? null,
    avatarDocumentId: c.profile?.avatarDocumentId ?? null,
    pathway,
    pathwayLabel: pathway ? (PATHWAY_LABELS[pathway as Pathway] ?? pathway) : null,
    projectCount: c._count.projects,
    followerCount: c._count.followers,
    isFollowing: opts.isFollowing,
    isFollowedBy: opts.isFollowedBy,
    verificationTier: c.verificationTier,
  };
}

/** Columns every creator list needs — kept in one place to avoid drift. */
const CREATOR_SELECT = {
  id: true,
  username: true,
  verificationTier: true,
  profile: { select: { fullName: true, headline: true, avatarDocumentId: true } },
  enrollments: {
    where: { enrollmentType: "ELECTIVE" },
    select: { pathway: true },
    take: 1,
  },
  _count: {
    select: { projects: { where: { visibility: PUBLIC_PROJECT_VISIBILITY } }, followers: true },
  },
} as const;

/** The columns to pull for the viewer's own follow edges, so we can show
 *  "Follows you" (follow-back) alongside the viewer's outgoing follows. */
function edgeSelect(viewerId: string, field: "followerId" | "followingId") {
  return { where: { [field]: viewerId }, select: { id: true }, take: 1 };
}

/**
 * Search creators by username or name (#3). Only students who have finished
 * setup appear — a half-built profile is not discoverable.
 */
export async function searchCreators(
  viewerId: string,
  query: string,
  options?: { limit?: number; pathway?: string }
): Promise<CreatorCard[]> {
  const term = query.trim();
  const creators = await db.user.findMany({
    where: {
      role: "STUDENT",
      status: "ACTIVE",
      onboardingCompletedAt: { not: null },
      ...(term
        ? {
            OR: [
              { username: { contains: term, mode: "insensitive" } },
              { profile: { fullName: { contains: term, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(options?.pathway
        ? { enrollments: { some: { pathway: options.pathway, status: "ACCEPTED" } } }
        : {}),
    },
    select: {
      ...CREATOR_SELECT,
      // Viewer → creator (am I following them?), and creator → viewer (do they
      // follow me, so the button can read "Follow back"?).
      followers: edgeSelect(viewerId, "followerId"),
      following: edgeSelect(viewerId, "followingId"),
    },
    orderBy: [{ username: "asc" }],
    take: options?.limit ?? 40,
  });

  return creators.map((c) =>
    toCreatorCard(c, {
      isFollowing: c.followers.length > 0,
      isFollowedBy: c.following.length > 0,
    })
  );
}

/** Creators the viewer follows, for the "Following" view. */
export async function getFollowedCreators(viewerId: string): Promise<CreatorCard[]> {
  const follows = await db.follow.findMany({
    where: { followerId: viewerId },
    orderBy: { createdAt: "desc" },
    select: {
      following: {
        select: {
          ...CREATOR_SELECT,
          // Does this creator follow the viewer back?
          followers: edgeSelect(viewerId, "followerId"),
        },
      },
    },
  });

  return follows.map(({ following: c }) =>
    toCreatorCard(c, { isFollowing: true, isFollowedBy: c.followers.length > 0 })
  );
}

/** Students who follow the viewer, for the "Followers" view. */
export async function getFollowers(viewerId: string): Promise<CreatorCard[]> {
  const follows = await db.follow.findMany({
    where: { followingId: viewerId },
    orderBy: { createdAt: "desc" },
    select: {
      follower: {
        select: {
          ...CREATOR_SELECT,
          // Does the viewer already follow this person back?
          followers: edgeSelect(viewerId, "followerId"),
        },
      },
    },
  });

  return follows.map(({ follower: c }) =>
    toCreatorCard(c, { isFollowing: c.followers.length > 0, isFollowedBy: true })
  );
}


/**
 * Public projects on a creator's profile (#4). "Completed" work is published
 * work; hidden and admin-restricted pieces are excluded unless the viewer owns
 * the profile.
 */
export async function getCreatorProjects(
  userId: string,
  options?: { includeHidden?: boolean; limit?: number }
) {
  return db.project.findMany({
    where: {
      userId,
      ...(options?.includeHidden ? {} : { visibility: PUBLIC_PROJECT_VISIBILITY }),
    },
    include: {
      course: { select: { name: true, slug: true } },
      assets: { select: { id: true, title: true, type: true, url: true, documentId: true } },
      _count: { select: { likes: true } },
    },
    orderBy: [{ featured: "desc" }, { completedAt: "desc" }],
    take: options?.limit,
  });
}
