import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().trim().min(3, "Give the round a title.").max(160),
  prompt: z.string().trim().min(5, "Add a prompt for reviewers.").max(2000),
  courseId: z.string().trim().optional().or(z.literal("")),
  pathway: z.string().trim().max(60).optional().or(z.literal("")),
  closesAt: z.string().trim().optional().or(z.literal("")),
});

/** Open a new Peer Body round. Staff only. */
export async function POST(request: Request) {
  const staff = await requireStaff();

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { title, prompt, courseId, pathway, closesAt } = parsed.data;

  if (courseId) {
    const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true } });
    if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  const round = await db.peerBodyRound.create({
    data: {
      title,
      prompt,
      courseId: courseId || null,
      pathway: pathway || null,
      closesAt: closesAt ? new Date(closesAt) : null,
      facilitatorId: staff.id,
    },
    select: { id: true },
  });

  await auditLog({
    actorId: staff.id,
    action: "PEER_BODY_ROUND_OPENED",
    targetType: "PeerBodyRound",
    targetId: round.id,
    metadata: { courseId: courseId || null, pathway: pathway || null },
  });

  return NextResponse.json({ ok: true, id: round.id });
}
