import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";

/** Delete a single notification. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;

  const existing = await db.notification.findUnique({
    where: { id },
    select: { id: true, title: true, userId: true },
  });
  if (!existing) return NextResponse.json({ error: "Notification not found." }, { status: 404 });

  await db.notification.delete({ where: { id } });
  await auditLog({
    actorId: staff.id,
    action: "NOTIFICATION_DELETED",
    targetType: "Notification",
    targetId: id,
    metadata: { title: existing.title, userId: existing.userId },
  });

  return NextResponse.json({ ok: true });
}