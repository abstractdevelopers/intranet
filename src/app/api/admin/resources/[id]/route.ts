import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  await db.lessonResource.delete({ where: { id } });
  await auditLog({ actorId: staff.id, action: "RESOURCE_DELETED", targetType: "LessonResource", targetId: id });
  return NextResponse.json({ ok: true });
}
