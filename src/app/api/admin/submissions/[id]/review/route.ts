import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog, notify } from "@/lib/audit";
import { issueCertificateIfComplete } from "@/lib/certificates";
import { publishProjectFromSubmission } from "@/lib/projects";
import { awardedScore, isPassing } from "@/lib/late-policy";

const schema = z.object({
  score: z.number().min(0),
  feedback: z.string().max(5000).optional(),
  requestRevision: z.boolean().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid review." }, { status: 400 });

  const submission = await db.assignmentSubmission.findUnique({
    where: { id },
    include: {
      assignment: {
        select: { title: true, maxScore: true, latePolicy: true, module: { select: { courseId: true } } },
      },
    },
  });
  if (!submission) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

  const { score: rawScore, feedback, requestRevision } = parsed.data;
  if (rawScore > submission.assignment.maxScore) {
    return NextResponse.json(
      { error: `Score can't exceed ${submission.assignment.maxScore}.` },
      { status: 400 }
    );
  }

  // A late submission under PENALTY loses a share of the maximum. The marker
  // enters the score the work earned; the policy applies the deduction.
  const { score, deducted } = awardedScore({
    rawScore,
    maxScore: submission.assignment.maxScore,
    late: submission.late,
    latePolicy: submission.assignment.latePolicy,
  });

  if (requestRevision) {
    await db.$transaction([
      db.assignmentSubmission.update({ where: { id }, data: { status: "NEEDS_REVISION" } }),
      ...(feedback
        ? [db.feedback.create({ data: { submissionId: id, authorId: staff.id, body: feedback } })]
        : []),
    ]);
    await notify({
      userId: submission.userId,
      type: "FEEDBACK",
      title: `Revision requested: ${submission.assignment.title}`,
      body: feedback ?? "Your reviewer asked for changes.",
    });
  } else {
    await db.$transaction([
      db.grade.upsert({
        where: { submissionId: id },
        create: {
          submissionId: id,
          score,
          maxScore: submission.assignment.maxScore,
          passed: isPassing(score, submission.assignment.maxScore),
          gradedById: staff.id,
        },
        update: {
          score,
          passed: isPassing(score, submission.assignment.maxScore),
          gradedById: staff.id,
        },
      }),
      db.assignmentSubmission.update({ where: { id }, data: { status: "GRADED" } }),
      ...(feedback
        ? [db.feedback.create({ data: { submissionId: id, authorId: staff.id, body: feedback } })]
        : []),
    ]);
    await notify({
      userId: submission.userId,
      type: "ASSIGNMENT_GRADED",
      title: `Graded: ${submission.assignment.title}`,
      body: deducted
        ? `You scored ${score}/${submission.assignment.maxScore} — ${deducted} point${deducted === 1 ? "" : "s"} was deducted because it was submitted after the deadline.`
        : `You scored ${score}/${submission.assignment.maxScore}.`,
    });
  }

  // A passing grade may complete the course — issue the certificate if so.
  if (!requestRevision) {
    await issueCertificateIfComplete(submission.userId, submission.assignment.module.courseId);
  }

  // Every submission is a portfolio piece from the moment it arrives (see
  // publishProjectFromSubmission), so a student's work is never invisible just
  // because marking is pending. Passing graded work becomes public; work that
  // did not pass stays a private draft the student can publish themselves.
  if (!requestRevision) {
    const project = await publishProjectFromSubmission(id, submission.userId);
    if (project && isPassing(score, submission.assignment.maxScore) && project.visibility !== "PUBLISHED") {
      await db.project.update({ where: { id: project.id }, data: { visibility: "PUBLISHED" } });
    }
  }

  await auditLog({
    actorId: staff.id,
    action: requestRevision ? "SUBMISSION_REVISION_REQUESTED" : "SUBMISSION_GRADED",
    targetType: "AssignmentSubmission",
    targetId: id,
    metadata: { score, maxScore: submission.assignment.maxScore },
  });

  return NextResponse.json({ ok: true });
}
