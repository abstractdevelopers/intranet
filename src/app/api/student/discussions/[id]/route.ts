import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOnboardedStudentApi } from "@/lib/rbac";
import { DISCUSSION_FEED_ENABLED } from "@/lib/constants";

export const dynamic = "force-dynamic";

const LOCKED = { error: "The discussion feed isn't available right now." };

/**
 * Delete one's own discussion post. Staff moderation lives in the admin portal
 * (hide/restore) so that it stays audit-logged and reversible; this route is
 * strictly self-service and author-scoped.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const user = guard.user;
  const { id: postId } = await params;

  if (!DISCUSSION_FEED_ENABLED) return NextResponse.json(LOCKED, { status: 403 });

  const post = await db.discussionPost.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });
  if (!post) return NextResponse.json({ error: "That discussion isn't available." }, { status: 404 });
  if (post.authorId !== user.id) {
    return NextResponse.json({ error: "You can only delete your own posts." }, { status: 403 });
  }

  // Replies and likes cascade with the post.
  await db.discussionPost.delete({ where: { id: postId } });
  return NextResponse.json({ ok: true });
}