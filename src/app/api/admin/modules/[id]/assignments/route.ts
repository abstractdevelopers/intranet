import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { assignmentSchema } from "@/lib/validators/course";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const parsed = assignmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the assignment details." }, { status: 400 });

  const mod = await db.module.findUnique({ where: { id }, select: { id: true } });
  if (!mod) return NextResponse.json({ error: "Module not found." }, { status: 404 });

  const assignment = await db.assignment.create({
    data: {
      moduleId: id,
      title: parsed.data.title,
      description: parsed.data.description,
      instructions: parsed.data.instructions || null,
      requirements: parsed.data.requirements || null,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
      maxScore: parsed.data.maxScore,
      allowedTypes: JSON.stringify(parsed.data.allowedTypes),
      maxFileSizeMb: parsed.data.maxFileSizeMb,
      maxAttempts: parsed.data.maxAttempts,
      latePolicy: parsed.data.latePolicy,
    },
  });
  await auditLog({ actorId: staff.id, action: "ASSIGNMENT_CREATED", targetType: "Assignment", targetId: assignment.id });
  return NextResponse.json({ ok: true, id: assignment.id });
}
