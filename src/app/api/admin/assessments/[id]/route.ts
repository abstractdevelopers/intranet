import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";

const schema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  pathway: z
    .enum(["GRAPHIC_DESIGN", "VIDEO_EDITING", "COMMUNICATION_INFLUENCE", "CONTENT_WRITING"])
    .nullable()
    .optional(),
  instructions: z.string().trim().max(20_000).nullable().optional(),
  openAt: z.string().datetime().nullable().optional(),
  closeAt: z.string().datetime().nullable().optional(),
  maxScore: z.number().int().min(1).max(1000).optional(),
  passMark: z.number().int().min(0).max(100).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the assessment details." }, { status: 400 });

  const data = parsed.data;
  await db.assessment.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.pathway !== undefined ? { pathway: data.pathway } : {}),
      ...(data.instructions !== undefined ? { instructions: data.instructions } : {}),
      ...(data.openAt !== undefined ? { openAt: data.openAt ? new Date(data.openAt) : null } : {}),
      ...(data.closeAt !== undefined ? { closeAt: data.closeAt ? new Date(data.closeAt) : null } : {}),
      ...(data.maxScore !== undefined ? { maxScore: data.maxScore } : {}),
      ...(data.passMark !== undefined ? { passMark: data.passMark } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });

  await auditLog({
    actorId: staff.id,
    action: "ASSESSMENT_UPDATED",
    targetType: "Assessment",
    targetId: id,
    metadata: { fields: Object.keys(data) },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;

  // Refuse to delete a paper that already has submissions — archive it instead,
  // so a student's work is never silently destroyed.
  const submissions = await db.assessmentSubmission.count({ where: { assessmentId: id } });
  if (submissions > 0) {
    return NextResponse.json(
      { error: "This paper has submissions. Archive it instead of deleting." },
      { status: 409 },
    );
  }

  await db.assessment.delete({ where: { id } });
  await auditLog({ actorId: staff.id, action: "ASSESSMENT_DELETED", targetType: "Assessment", targetId: id });
  return NextResponse.json({ ok: true });
}
