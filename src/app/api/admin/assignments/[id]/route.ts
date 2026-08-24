import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { assignmentSchema } from "@/lib/validators/course";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const parsed = assignmentSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the assignment details." }, { status: 400 });

  const { allowedTypes, deadline, ...rest } = parsed.data;
  await db.assignment.update({
    where: { id },
    data: {
      ...rest,
      ...(allowedTypes ? { allowedTypes: JSON.stringify(allowedTypes) } : {}),
      ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null } : {}),
    },
  });
  await auditLog({ actorId: staff.id, action: "ASSIGNMENT_UPDATED", targetType: "Assignment", targetId: id });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const submissions = await db.assignmentSubmission.count({ where: { assignmentId: id } });
  if (submissions > 0) {
    return NextResponse.json(
      { error: "Students have submitted work for this assignment — archive it instead of deleting." },
      { status: 400 }
    );
  }
  await db.assignment.delete({ where: { id } });
  await auditLog({ actorId: staff.id, action: "ASSIGNMENT_DELETED", targetType: "Assignment", targetId: id });
  return NextResponse.json({ ok: true });
}
