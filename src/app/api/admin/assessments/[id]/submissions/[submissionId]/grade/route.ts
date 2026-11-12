import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog, notify } from "@/lib/audit";
import { gradeTheorySubmission, gradePracticalSubmission } from "@/lib/assessments";

/**
 * Mark an assessment submission.
 *
 * A THEORY paper is marked per written question (`marks`, keyed by question id,
 * in points). A PRACTICAL paper is marked out of its max score. The final
 * percentage is recomputed in the library, never trusted from the client.
 */
const schema = z.object({
  // Theory: points awarded per TEXT question.
  marks: z.record(z.string(), z.number().min(0)).optional(),
  // Practical: the score out of maxScore.
  score: z.number().min(0).optional(),
  feedback: z.string().trim().max(5000).nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; submissionId: string }> },
) {
  const staff = await requireStaff();
  const { id, submissionId } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the marks." }, { status: 400 });

  const submission = await db.assessmentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      assessment: {
        select: { id: true, kind: true, title: true, maxScore: true },
      },
    },
  });
  if (!submission || submission.assessmentId !== id) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  try {
    if (submission.assessment.kind === "THEORY") {
      if (!parsed.data.marks) {
        return NextResponse.json({ error: "Provide marks for the written answers." }, { status: 400 });
      }
      await gradeTheorySubmission({
        submissionId,
        staffId: staff.id,
        marks: parsed.data.marks,
        feedback: parsed.data.feedback ?? null,
      });
    } else {
      if (parsed.data.score === undefined) {
        return NextResponse.json({ error: "Provide a score." }, { status: 400 });
      }
      if (parsed.data.score > submission.assessment.maxScore) {
        return NextResponse.json(
          { error: `Score can't exceed ${submission.assessment.maxScore}.` },
          { status: 400 },
        );
      }
      await gradePracticalSubmission({
        submissionId,
        staffId: staff.id,
        score: parsed.data.score,
        feedback: parsed.data.feedback ?? null,
      });
    }
  } catch (err) {
    console.error("[assessment:grade]", err);
    return NextResponse.json({ error: "We couldn't save that mark." }, { status: 500 });
  }

  await notify({
    userId: submission.userId,
    type: "ASSESSMENT_GRADED",
    title: `Marked: ${submission.assessment.title}`,
    body: "Your assessment has been marked. Your result will be released once all marking is complete.",
  });

  await auditLog({
    actorId: staff.id,
    action: "ASSESSMENT_GRADED",
    targetType: "AssessmentSubmission",
    targetId: submissionId,
    metadata: { assessmentId: id, kind: submission.assessment.kind },
  });

  return NextResponse.json({ ok: true });
}
