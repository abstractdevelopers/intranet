import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog, notify } from "@/lib/audit";
import { DISCUSSION_FEED_ENABLED } from "@/lib/constants";

export const dynamic = "force-dynamic";

const LOCKED = { error: "The discussion feed isn't available right now." };

const schema = z.object({
  action: z.enum(["HIDE", "RESTORE", "DELETE"]),
  reason: z.string().trim().max(300).optional(),
  // Whether the moderation applies to the post itself or a single reply.
  target: z.enum(["POST", "REPLY"]).default("POST"),
});

/**
 * Moderate a discussion post or reply. Hiding is reversible and keeps the row
 * so a mistaken removal can be undone; deletion is permanent and audited.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;

  if (!DISCUSSION_FEED_ENABLED) return NextResponse.json(LOCKED, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { action, reason, target } = parsed.data;

  // The post and reply tables have identical moderation columns, but Prisma's
  // per-model delegates are not interchangeable, so the branches are explicit.
  const record =
    target === "REPLY"
      ? await db.discussionReply.findUnique({
          where: { id },
          select: { id: true, authorId: true, status: true },
        })
      : await db.discussionPost.findUnique({
          where: { id },
          select: { id: true, authorId: true, status: true },
        });
  if (!record) {
    return NextResponse.json(
      { error: target === "REPLY" ? "Reply not found." : "Discussion not found." },
      { status: 404 }
    );
  }

  if (action === "DELETE") {
    if (target === "REPLY") await db.discussionReply.delete({ where: { id } });
    else await db.discussionPost.delete({ where: { id } });
    await auditLog({
      actorId: staff.id,
      action: target === "REPLY" ? "DISCUSSION_REPLY_DELETED" : "DISCUSSION_POST_DELETED",
      targetType: target === "REPLY" ? "DiscussionReply" : "DiscussionPost",
      targetId: id,
      metadata: { reason: reason ?? null },
    });
    return NextResponse.json({ ok: true, status: "DELETED" });
  }

  const hiding = action === "HIDE";
  const data = {
    status: hiding ? "HIDDEN" : "PUBLISHED",
    hiddenReason: hiding ? reason ?? null : null,
    hiddenAt: hiding ? new Date() : null,
    hiddenById: hiding ? staff.id : null,
  };
  if (target === "REPLY") await db.discussionReply.update({ where: { id }, data });
  else await db.discussionPost.update({ where: { id }, data });

  await auditLog({
    actorId: staff.id,
    action: hiding
      ? target === "REPLY"
        ? "DISCUSSION_REPLY_HIDDEN"
        : "DISCUSSION_POST_HIDDEN"
      : target === "REPLY"
        ? "DISCUSSION_REPLY_RESTORED"
        : "DISCUSSION_POST_RESTORED",
    targetType: target === "REPLY" ? "DiscussionReply" : "DiscussionPost",
    targetId: id,
    metadata: { reason: reason ?? null },
  });

  // Tell the author what happened and why, so moderation isn't silent.
  if (hiding && record.authorId !== staff.id) {
    await notify({
      userId: record.authorId,
      type: "DISCUSSION_MODERATED",
      title: target === "REPLY" ? "Your reply was hidden" : "Your post was hidden",
      body: reason ?? "A moderator removed it from the feed.",
    });
  }

  return NextResponse.json({ ok: true, status: hiding ? "HIDDEN" : "PUBLISHED" });
}