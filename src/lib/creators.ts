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
  verificationTier: string | null;
};

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
      followers: { where: { followerId: viewerId }, select: { id: true }, take: 1 },
    },
    orderBy: [{ username: "asc" }],
    take: options?.limit ?? 40,
  });

  return creators.map((c) => {
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
      isFollowing: c.followers.length > 0,
      verificationTier: c.verificationTier,
    };
  });
}

/** Creators the viewer follows, for the "Following" view. */
export async function getFollowedCreators(viewerId: string): Promise<CreatorCard[]> {
  const follows = await db.follow.findMany({
    where: { followerId: viewerId },
    orderBy: { createdAt: "desc" },
    select: {
      following: {
        select: {
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
            select: {
              projects: { where: { visibility: PUBLIC_PROJECT_VISIBILITY } },
              followers: true,
            },
          },
        },
      },
    },
  });

  return follows.map(({ following: c }) => {
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
      isFollowing: true,
      verificationTier: c.verificationTier,
    };
  });
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
