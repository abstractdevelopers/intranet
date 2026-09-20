import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOnboardedStudentApi } from "@/lib/rbac";
import { canAccessPost } from "@/lib/discussions";

export const dynamic = "force-dynamic";

/** Like / unlike a discussion post. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const user = guard.user;
  const { id: postId } = await params;

  const post = await db.discussionPost.findFirst({
    where: { id: postId, status: "PUBLISHED" },
    select: { id: true, pathway: true, status: true, authorId: true },
  });
  if (!post || !(await canAccessPost(user.id, post))) {
    return NextResponse.json({ error: "That discussion isn't available." }, { status: 404 });
  }

  const existing = await db.discussionLike.findUnique({
    where: { postId_userId: { postId, userId: user.id } },
  });

  if (existing) {
    await db.discussionLike.delete({ where: { id: existing.id } });
    const count = await db.discussionLike.count({ where: { postId } });
    return NextResponse.json({ ok: true, liked: false, count });
  }

  await db.discussionLike.create({ data: { postId, userId: user.id } });
  const count = await db.discussionLike.count({ where: { postId } });
  return NextResponse.json({ ok: true, liked: true, count });
}