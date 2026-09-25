import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { PEER_BODY_STATUS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const schema = z.object({
  status: z.enum([PEER_BODY_STATUS.REVIEWING, PEER_BODY_STATUS.CLOSED]),
});

/** Close or reopen a round. Staff only. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a valid status." }, { status: 400 });
  }

  const round = await db.peerBodyRound.findUnique({ where: { id }, select: { id: true } });
  if (!round) return NextResponse.json({ error: "Round not found." }, { status: 404 });

  await db.peerBodyRound.update({ where: { id }, data: { status: parsed.data.status } });

  await auditLog({
    actorId: staff.id,
    action: "PEER_BODY_ROUND_STATUS",
    targetType: "PeerBodyRound",
    targetId: id,
    metadata: { status: parsed.data.status },
  });

  return NextResponse.json({ ok: true });
}
