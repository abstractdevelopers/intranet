import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";

const eventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  date: z.string().datetime({ offset: true }).optional(),
  audience: z.enum(["ACADEMY", "COURSE"]).optional(),
  courseId: z.string().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the event details." }, { status: 400 });

  const { title, date, audience, courseId } = parsed.data;
  await db.event.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(date !== undefined ? { date: new Date(date) } : {}),
      ...(audience !== undefined ? { audience } : {}),
      ...(courseId !== undefined ? { courseId } : {}),
    },
  });
  await auditLog({ actorId: staff.id, action: "EVENT_UPDATED", targetType: "Event", targetId: id });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  await db.event.delete({ where: { id } });
  await auditLog({ actorId: staff.id, action: "EVENT_DELETED", targetType: "Event", targetId: id });
  return NextResponse.json({ ok: true });
}
