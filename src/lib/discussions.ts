import { db } from "./db";
import { DISCUSSION_FEED_ENABLED, PATHWAY_LABELS, type Pathway } from "./constants";
import { getStudentPathway } from "./communities";

/**
 * The feed is locked off while the academy runs on WhatsApp communities. Every
 * read and write checks this so the feature can't be reached by calling its
 * APIs directly. Pages are also blocked, but this is the boundary that matters.
 */
export function isDiscussionFeedEnabled() {
  return DISCUSSION_FEED_ENABLED;
}

/** A feed a student can read and post to. */
export type FeedScope = {
  /** null = the general academy feed. */
  pathway: Pathway | null;
  label: string;
};

/**
 * Feeds a student belongs to: the general academy feed plus their pathway feed
 * when they have one. Mirrors how invite-link communities are scoped, so the
 * two features stay consistent.
 */
export async function getVisibleFeeds(userId: string): Promise<FeedScope[]> {
  if (!DISCUSSION_FEED_ENABLED) return [];
  const { pathway } = await getStudentPathway(userId);
  const feeds: FeedScope[] = [{ pathway: null, label: "Academy" }];
  if (pathway) feeds.push({ pathway, label: PATHWAY_LABELS[pathway] });
  return feeds;
}

/**
 * The pathway a student may post into. Only their own pathway (or the general
 * feed) is writable — a student can never post into another pathway's feed even
 * though they can see the feed names.
 */
export async function resolveWritablePathway(
  userId: string,
  requested: string | null | undefined
): Promise<{ ok: true; pathway: Pathway | null } | { ok: false; reason: string }> {
  if (!DISCUSSION_FEED_ENABLED) {
    return { ok: false, reason: "The discussion feed isn't available right now." };
  }
  const { pathway: own } = await getStudentPathway(userId);

  if (!requested) return { ok: true, pathway: null };

  const known = Object.prototype.hasOwnProperty.call(PATHWAY_LABELS, requested);
  if (!known) return { ok: false, reason: "That feed doesn't exist." };
  if (!own) {
    return { ok: false, reason: "Your pathway is set once your elective is approved." };
  }
  if (requested !== own) {
    return { ok: false, reason: "You can only post in your own pathway's feed." };
  }
  return { ok: true, pathway: own };
}

/**
 * Whether a student can read a given post. General posts are open to every
 * student; pathway posts are limited to students on that pathway. Used by every
 * route that takes a post id from the client, so scoping can't be bypassed by
 * guessing an id.
 */
export async function canAccessPost(
  userId: string,
  post: { pathway: string | null; status: string; authorId: string }
): Promise<boolean> {
  if (!DISCUSSION_FEED_ENABLED) return false;
  if (!post.pathway) return true;
  const { pathway: own } = await getStudentPathway(userId);
  return own === post.pathway;
}

const AUTHOR_SELECT = {
  id: true,
  username: true,
  verificationTier: true,
  role: true,
  profile: { select: { fullName: true, avatarDocumentId: true } },
} as const;

export type FeedPost = Awaited<ReturnType<typeof getFeedPosts>>[number];

/**
 * Posts for the feeds a student can see, newest first, pinned first. Replies and
 * likes are counted in the same query rather than per-row, which matters because
 * each extra round-trip to the pooled database is expensive.
 */
export async function getFeedPosts(
  userId: string,
  options: { pathway?: Pathway | null; take?: number } = {}
) {
  if (!DISCUSSION_FEED_ENABLED) return [];
  const { pathway } = await getStudentPathway(userId);
  const feeds = options.pathway === undefined ? [null, pathway] : [options.pathway];

  const visible = feeds.filter((f): f is Pathway | null => f !== undefined);

  return db.discussionPost.findMany({
    where: {
      status: "PUBLISHED",
      // General feed (null) is always readable; a pathway feed only when it
      // matches the student's own pathway.
      OR: visible.map((f) => (f === null ? { pathway: null } : { pathway: f })),
    },
    include: {
      author: { select: AUTHOR_SELECT },
      _count: { select: { replies: { where: { status: "PUBLISHED" } }, likes: true } },
      likes: { where: { userId }, select: { id: true } },
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: options.take ?? 50,
  });
}

/** A single post with its visible replies, or null when it isn't accessible. */
export async function getPostThread(userId: string, postId: string) {
  if (!DISCUSSION_FEED_ENABLED) return null;
  const post = await db.discussionPost.findFirst({
    where: { id: postId, status: "PUBLISHED" },
    include: {
      author: { select: AUTHOR_SELECT },
      _count: { select: { replies: { where: { status: "PUBLISHED" } }, likes: true } },
      likes: { where: { userId }, select: { id: true } },
    },
  });
  if (!post) return null;
  if (!(await canAccessPost(userId, post))) return null;

  const replies = await db.discussionReply.findMany({
    where: { postId, status: "PUBLISHED" },
    include: { author: { select: AUTHOR_SELECT } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return { post, replies };
}

export type DiscussionAuthor = {
  id: string;
  username: string | null;
  verificationTier: string | null;
  role: string;
  profile: { fullName: string | null; avatarDocumentId: string | null } | null;
};