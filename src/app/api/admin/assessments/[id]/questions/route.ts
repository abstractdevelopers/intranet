import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";

/**
 * Replace a paper's questions wholesale.
 *
 * Same shape as the Intranet 101 seed: the admin editor is the single source of
 * truth, so posting the full list replaces what is there. Existing submissions
 * are left untouched — their stored answers simply refer to questions that may
 * no longer exist, which is why a published paper is edited with care.
 */
const optionSchema = z.object({
  label: z.string().trim().min(1).max(1000),
  isCorrect: z.boolean().optional(),
});

const questionSchema = z.object({
  kind: z.enum(["MCQ", "TEXT"]),
  prompt: z.string().trim().min(1).max(4000),
  explanation: z.string().trim().max(4000).nullable().optional(),
  points: z.number().int().min(1).max(100),
  options: z.array(optionSchema).max(10).optional(),
});

const schema = z.object({ questions: z.array(questionSchema).max(200) });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const questions = await db.assessmentQuestion.findMany({
    where: { assessmentId: id },
    orderBy: { order: "asc" },
    include: { options: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json({ questions });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the questions." }, { status: 400 });

  const assessment = await db.assessment.findUnique({ where: { id }, select: { id: true } });
  if (!assessment) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });

  // An MCQ needs exactly one correct option; a TEXT question needs none.
  for (const q of parsed.data.questions) {
    if (q.kind === "MCQ") {
      const options = q.options ?? [];
      const correct = options.filter((o) => o.isCorrect).length;
      if (options.length < 2) {
        return NextResponse.json({ error: "Each multiple-choice question needs at least two options." }, { status: 400 });
      }
      if (correct !== 1) {
        return NextResponse.json(
          { error: "Each multiple-choice question needs exactly one correct answer." },
          { status: 400 },
        );
      }
    }
  }

  await db.$transaction(async (tx) => {
    await tx.assessmentQuestion.deleteMany({ where: { assessmentId: id } });
    for (const [index, q] of parsed.data.questions.entries()) {
      await tx.assessmentQuestion.create({
        data: {
          assessmentId: id,
          kind: q.kind,
          prompt: q.prompt,
          explanation: q.explanation ?? null,
          points: q.points,
          order: index,
          options:
            q.kind === "MCQ"
              ? {
                  create: (q.options ?? []).map((o, i) => ({
                    label: o.label,
                    isCorrect: Boolean(o.isCorrect),
                    order: i,
                  })),
                }
              : undefined,
        },
      });
    }
  });

  await auditLog({
    actorId: staff.id,
    action: "ASSESSMENT_QUESTIONS_SET",
    targetType: "Assessment",
    targetId: id,
    metadata: { count: parsed.data.questions.length },
  });
  return NextResponse.json({ ok: true });
}
