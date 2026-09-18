import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog, notify } from "@/lib/audit";

const schema = z.object({
  reviewNote: z.string().trim().max(2000).optional(),
  markReviewed: z.boolean().optional(),
});

/** Staff review of a student's Captain's Log (#12, #16). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid review." }, { status: 400 });

  const log = await db.captainLog.findUnique({
    where: { id },
    select: { id: true, userId: true, weekNumber: true },
  });
  if (!log) return NextResponse.json({ error: "Log not found." }, { status: 404 });

  const markReviewed = parsed.data.markReviewed ?? true;
  await db.captainLog.update({
    where: { id },
    data: {
      status: markReviewed ? "REVIEWED" : "SUBMITTED",
      reviewedById: markReviewed ? staff.id : null,
      reviewedAt: markReviewed ? new Date() : null,
      reviewNote: parsed.data.reviewNote ?? null,
    },
  });

  // A note is feedback the student should see.
  if (parsed.data.reviewNote) {
    await notify({
      userId: log.userId,
      type: "FEEDBACK",
      title: `Note on your Week ${log.weekNumber} Captain's Log`,
      body: parsed.data.reviewNote,
    });
  }

  await auditLog({
    actorId: staff.id,
    action: markReviewed ? "CAPTAIN_LOG_REVIEWED" : "CAPTAIN_LOG_REVIEW_CLEARED",
    targetType: "CaptainLog",
    targetId: id,
    metadata: { weekNumber: log.weekNumber },
  });

  return NextResponse.json({ ok: true });
}