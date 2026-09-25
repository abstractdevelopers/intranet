import { db } from "./db";
import { PROMISE_GOALS, type PromiseGoal } from "./constants";

/**
 * Warm-up — the pre-class course task.
 *
 * Every student writes one line for their course, plus a small goal picked
 * from a short fixed list. The craft comes from their elective, so the task is
 * framed for what they are actually studying. It is still tiny — one sentence —
 * which is what keeps it a warm-up rather than another chore.
 */

export type WallEntry = {
  id: string;
  body: string;
  goal: string | null;
  pathway: string | null;
  createdAt: Date;
  cheerCount: number;
  cheeredByViewer: boolean;
  author: {
    id: string;
    username: string | null;
    fullName: string;
    avatarDocumentId: string | null;
    eliteMemberNumber: number | null;
    verificationTier: string | null;
  };
  isFollowing: boolean;
  isOwn: boolean;
};

export const PROMISE_MAX_LENGTH = 180;

/** Normalise a stored goal key to its label, tolerating unknown/legacy values. */
export function goalLabel(goal: string | null | undefined): string | null {
  if (!goal) return null;
  return PROMISE_GOALS[goal as PromiseGoal] ?? null;
}

/** The whole wall, newest first, annotated with the viewer's follow + cheer state. */
export async function getWall(
  viewerId: string,
  opts: { pathway?: string | null; limit?: number } = {}
): Promise<WallEntry[]> {
  const promises = await db.promise.findMany({
    where: opts.pathway ? { pathway: opts.pathway } : {},
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 200,
    select: {
      id: true,
      body: true,
      goal: true,
      pathway: true,
      createdAt: true,
      userId: true,
      user: {
        select: {
          id: true,
          username: true,
          eliteMemberNumber: true,
          verificationTier: true,
          profile: { select: { fullName: true, avatarDocumentId: true } },
        },
      },
      _count: { select: { cheers: true } },
      cheers: { where: { userId: viewerId }, select: { id: true } },
    },
  });

  const authorIds = promises.map((p) => p.userId);
  const follows = await db.follow.findMany({
    where: { followerId: viewerId, followingId: { in: authorIds } },
    select: { followingId: true },
  });
  const following = new Set(follows.map((f) => f.followingId));

  return promises.map((p) => ({
    id: p.id,
    body: p.body,
    goal: p.goal,
    pathway: p.pathway,
    createdAt: p.createdAt,
    cheerCount: p._count.cheers,
    cheeredByViewer: p.cheers.length > 0,
    author: {
      id: p.user.id,
      username: p.user.username,
      fullName: p.user.profile?.fullName ?? "UCA student",
      avatarDocumentId: p.user.profile?.avatarDocumentId ?? null,
      eliteMemberNumber: p.user.eliteMemberNumber,
      verificationTier: p.user.verificationTier,
    },
    isFollowing: following.has(p.userId),
    isOwn: p.userId === viewerId,
  }));
}

/** The viewer's own promise, if they have posted one. */
export async function getMyPromise(userId: string) {
  return db.promise.findUnique({
    where: { userId },
    select: { id: true, body: true, goal: true, pathway: true },
  });
}

/** How many creators have posted, for the wall's header counter. */
export async function getWallCount() {
  return db.promise.count();
}

/**
 * How many promises exist per craft. Used for the quiet craft filter counts,
 * so a student can see where their course stands without it being a contest.
 */
export async function getCraftCounts(): Promise<Record<string, number>> {
  const rows = await db.promise.groupBy({
    by: ["pathway"],
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.pathway) out[r.pathway] = r._count._all;
  }
  return out;
}

/** The craft the wall should pre-select for this student, from their elective. */
export async function getViewerPathway(userId: string): Promise<string | null> {
  const enrolment = await db.enrollment.findFirst({
    where: { userId, enrollmentType: "ELECTIVE", pathway: { not: null } },
    select: { pathway: true },
    orderBy: { createdAt: "desc" },
  });
  return enrolment?.pathway ?? null;
}

/** Cheer or un-cheer a promise. Returns the new count and viewer state. */
export async function toggleCheer(promiseId: string, userId: string) {
  const promise = await db.promise.findUnique({
    where: { id: promiseId },
    select: { id: true, userId: true },
  });
  if (!promise) return null;

  const existing = await db.promiseCheer.findUnique({
    where: { promiseId_userId: { promiseId, userId } },
    select: { id: true },
  });

  if (existing) {
    await db.promiseCheer.delete({ where: { id: existing.id } });
  } else {
    await db.promiseCheer.create({ data: { promiseId, userId } });
  }

  const count = await db.promiseCheer.count({ where: { promiseId } });
  return { cheered: !existing, count };
}
