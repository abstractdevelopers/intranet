import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOnboardedStudentApi } from "@/lib/rbac";
import { getAssessmentView, submitTheory } from "@/lib/assessments";

/**
 * Theory assessment.
 *
 * GET returns the paper with correct answers stripped — `AssessmentOption`
 * `isCorrect` is never selected here, so answers can't be read from the page.
 * POST grades MCQ answers on the server; written answers wait for staff.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const view = await getAssessmentView(id, guard.user.id);
  if (!view || view.kind !== "THEORY") {
    return NextResponse.json({ error: "Assessment not available." }, { status: 404 });
  }
  return NextResponse.json(view);
}

const schema = z.object({
  answers: z.record(z.string(), z.string()),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid submission." }, { status: 400 });

  const result = await submitTheory(guard.user.id, id, parsed.data.answers);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
