import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";

/** Archive or restore a saved template. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { isArchived?: boolean } | null;
  if (typeof body?.isArchived !== "boolean") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const existing = await db.emailTemplate.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Template not found." }, { status: 404 });

  await db.emailTemplate.update({ where: { id }, data: { isArchived: body.isArchived } });
  await auditLog({
    actorId: staff.id,
    action: "EMAIL_TEMPLATE_ARCHIVED",
    targetType: "EmailTemplate",
    targetId: id,
    metadata: { isArchived: body.isArchived },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;

  const existing = await db.emailTemplate.findUnique({ where: { id }, select: { name: true } });
  if (!existing) return NextResponse.json({ error: "Template not found." }, { status: 404 });

  await db.emailTemplate.delete({ where: { id } });
  await auditLog({
    actorId: staff.id,
    action: "EMAIL_TEMPLATE_DELETED",
    targetType: "EmailTemplate",
    targetId: id,
    metadata: { name: existing.name },
  });
  return NextResponse.json({ ok: true });
}