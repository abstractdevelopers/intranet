import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { moduleSchema } from "@/lib/validators/course";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const parsed = moduleSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the module details." }, { status: 400 });

  await db.module.update({
    where: { id },
    data: {
      ...parsed.data,
      releaseAt:
        parsed.data.releaseAt === undefined
          ? undefined
          : parsed.data.releaseAt
            ? new Date(parsed.data.releaseAt)
            : null,
    },
  });
  await auditLog({ actorId: staff.id, action: "MODULE_UPDATED", targetType: "Module", targetId: id });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  await db.module.delete({ where: { id } });
  await auditLog({ actorId: staff.id, action: "MODULE_DELETED", targetType: "Module", targetId: id });
  return NextResponse.json({ ok: true });
}
