import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog, notify } from "@/lib/audit";

const schema = z.object({ action: z.enum(["SUSPEND", "REACTIVATE"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });

  const student = await db.user.findFirst({ where: { id, role: "STUDENT" }, select: { id: true } });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const suspend = parsed.data.action === "SUSPEND";
  await db.$transaction([
    db.user.update({ where: { id }, data: { status: suspend ? "SUSPENDED" : "ACTIVE" } }),
    db.enrollment.updateMany({
      where: { userId: id, status: suspend ? "ACCEPTED" : "SUSPENDED" },
      data: { status: suspend ? "SUSPENDED" : "ACCEPTED" },
    }),
    // End sessions immediately on suspension.
    ...(suspend ? [db.session.deleteMany({ where: { userId: id } })] : []),
  ]);

  await notify({
    userId: id,
    type: suspend ? "ENROLLMENT_REJECTED" : "ENROLLMENT_ACCEPTED",
    title: suspend ? "Your account has been suspended" : "Your account has been reactivated",
    body: suspend
      ? "Contact the academy if you believe this is a mistake."
      : "Your courses are available again.",
  });

  await auditLog({
    actorId: staff.id,
    action: suspend ? "STUDENT_SUSPENDED" : "STUDENT_REACTIVATED",
    targetType: "User",
    targetId: id,
  });

  return NextResponse.json({ ok: true });
}
