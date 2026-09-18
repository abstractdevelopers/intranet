import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOnboardedStudentApi } from "@/lib/rbac";
import { auditLog, notify } from "@/lib/audit";
import { canViewCreator } from "@/lib/projects";

export const dynamic = "force-dynamic";

/** Follow / unfollow another creator (#3). */
export async function POST(request: Request) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const user = guard.user;
  const body = await request.json().catch(() => null);
  const targetId = String((body as { userId?: unknown } | null)?.userId ?? "");
  if (!targetId) return NextResponse.json({ error: "Choose somebody to follow." }, { status: 400 });
  if (targetId === user.id) {
    return NextResponse.json({ error: "You can't follow yourself." }, { status: 400 });
  }

  if (!(await canViewCreator(user.id, targetId))) {
    return NextResponse.json({ error: "That creator isn't available." }, { status: 404 });
  }

  const existing = await db.follow.findUnique({
    where: { followerId_followingId: { followerId: user.id, followingId: targetId } },
  });

  if (existing) {
    await db.follow.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, following: false });
  }

  await db.follow.create({ data: { followerId: user.id, followingId: targetId } });
  await notify({
    userId: targetId,
    type: "NEW_FOLLOWER",
    title: `${user.fullName} started following you`,
    body: "Open your creator profile to see who's following your work.",
  });
  await auditLog({
    actorId: user.id,
    action: "CREATOR_FOLLOWED",
    targetType: "User",
    targetId,
  });

  return NextResponse.json({ ok: true, following: true });
}
