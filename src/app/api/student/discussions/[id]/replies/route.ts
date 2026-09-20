import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOnboardedStudentApi } from "@/lib/rbac";
import { notify } from "@/lib/audit";
import { canAccessPost } from "@/lib/discussions";

export const dynamic = "force-dynamic";

const schema = z.object({
  body: z.string().trim().min(1, "Write a reply before sending.").max(3000),
});

/** Reply to a discussion. Scoping follows the parent post. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const user = guard.user;
  const { id: postId } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const post = await db.discussionPost.findFirst({
    where: { id: postId, status: "PUBLISHED" },
    select: { id: true, authorId: true, pathway: true, status: true, title: true, body: true },
  });
  if (!post) return NextResponse.json({ error: "That discussion isn't available." }, { status: 404 });

  // A student can only reply inside a feed they can read.
  if (!(await canAccessPost(user.id, post))) {
    return NextResponse.json({ error: "That discussion isn't available." }, { status: 404 });
  }

  const reply = await db.discussionReply.create({
    data: { postId, authorId: user.id, body: parsed.data.body },
    select: { id: true },
  });

  if (post.authorId !== user.id) {
    await notify({
      userId: post.authorId,
      type: "DISCUSSION_REPLY",
      title: `${user.fullName} replied to your post`,
      body: parsed.data.body.slice(0, 140),
    });
  }

  return NextResponse.json({ ok: true, id: reply.id });
}