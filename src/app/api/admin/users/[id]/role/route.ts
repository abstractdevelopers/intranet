import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canManageRoles } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { ROLES } from "@/lib/constants";

const schema = z.object({
  role: z.enum(Object.keys(ROLES) as [keyof typeof ROLES, ...(keyof typeof ROLES)[]]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getSessionUser();
  if (!actor || !canManageRoles(actor.role)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  if (id === actor.id) {
    return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (target.role === "FOUNDER" && actor.role !== "FOUNDER") {
    return NextResponse.json({ error: "Only a founder can change another founder's role." }, { status: 403 });
  }
  if (target.role === parsed.data.role) {
    return NextResponse.json({ ok: true });
  }

  await db.user.update({ where: { id }, data: { role: parsed.data.role } });
  // Force re-authentication under the new role.
  await db.session.deleteMany({ where: { userId: id } });

  await auditLog({
    actorId: actor.id,
    action: "USER_ROLE_CHANGED",
    targetType: "User",
    targetId: id,
    metadata: { from: target.role, to: parsed.data.role, email: target.email },
  });

  return NextResponse.json({ ok: true });
}
