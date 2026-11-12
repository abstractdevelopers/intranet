import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { GradeForm } from "@/components/admin/grade-form";
import { IconFile } from "@/components/icons";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Mark submission" };

/**
 * Mark one assessment submission.
 *
 * Theory: shows every question, the student's answer, and the auto-scored MCQ
 * result, then collects a mark per written question. Practical: shows the
 * deliverable (text, link, files) and collects a score.
 */
export default async function MarkSubmissionPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  await requireStaff();
  const { id, submissionId } = await params;

  const submission = await db.assessmentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      user: { include: { profile: true } },
      files: true,
      assessment: {
        include: { questions: { orderBy: { order: "asc" }, include: { options: true } } },
      },
    },
  });
  if (!submission || submission.assessmentId !== id) notFound();

  const assessment = submission.assessment;
  const answers =
    submission.answers && typeof submission.answers === "object"
      ? (submission.answers as Record<string, string>)
      : {};
  const marks =
    submission.marks && typeof submission.marks === "object"
      ? (submission.marks as Record<string, number>)
      : {};

  const writtenQuestions = assessment.questions
    .filter((q) => q.kind === "TEXT")
    .map((q) => ({ id: q.id, prompt: q.prompt, points: q.points, answer: answers[q.id] ?? "" }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav className="text-xs text-text-muted">
        <Link href="/admin/assessments" className="hover:text-brand-1">
          Assessments
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/admin/assessments/${assessment.id}`} className="hover:text-brand-1">
          {assessment.title}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-text">Mark</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{assessment.kind === "THEORY" ? "Theory" : "Practical"} submission</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {submission.user.profile?.fullName ?? submission.user.email}
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            Submitted {formatDateTime(submission.submittedAt)}
            {submission.autoScore !== null ? ` · MCQ ${Math.round(submission.autoScore)}%` : ""}
          </p>
        </div>
        <Badge tone={statusTone(submission.status)}>{submission.status.toLowerCase()}</Badge>
      </header>

      {assessment.kind === "THEORY" ? (
        <Card className="p-6">
          <p className="eyebrow">Answers</p>
          <ol className="mt-4 space-y-4">
            {assessment.questions.map((q, qi) => {
              const chosen = answers[q.id];
              if (q.kind === "MCQ") {
                const correct = q.options.find((o) => o.isCorrect);
                const isRight = chosen === correct?.id;
                return (
                  <li key={q.id} className="text-sm">
                    <p className="font-medium">
                      {qi + 1}. {q.prompt}
                    </p>
                    <p className={`mt-1 ${isRight ? "text-success" : "text-danger"}`}>
                      {q.options.find((o) => o.id === chosen)?.label ?? "No answer"} {isRight ? "✓" : "✗"}
                    </p>
                    {!isRight && correct ? (
                      <p className="mt-0.5 text-xs text-text-muted">Correct: {correct.label}</p>
                    ) : null}
                  </li>
                );
              }
              return null;
            })}
          </ol>
        </Card>
      ) : (
        <Card className="p-6">
          <p className="eyebrow">Deliverable</p>
          <div className="mt-3 space-y-3 text-sm">
            {submission.externalUrl ? (
              <p>
                <a
                  href={submission.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-brand-1 underline-offset-2 hover:underline dark:text-brand-3"
                >
                  {submission.externalUrl}
                </a>
              </p>
            ) : null}
            {submission.files.map((f) => (
              <p key={f.id}>
                <a
                  href={`/api/documents/${f.documentId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 font-medium text-brand-1 underline-offset-2 hover:underline dark:text-brand-3"
                >
                  <IconFile className="h-4 w-4" /> {f.fileName}
                </a>
              </p>
            ))}
            {submission.textContent ? (
              <p className="whitespace-pre-wrap rounded-lg bg-surface-2 p-3">{submission.textContent}</p>
            ) : null}
            {!submission.externalUrl && submission.files.length === 0 && !submission.textContent ? (
              <p className="text-text-muted">No deliverable attached.</p>
            ) : null}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <p className="eyebrow">Your mark</p>
        <div className="mt-4">
          <GradeForm
            assessmentId={assessment.id}
            submissionId={submission.id}
            kind={assessment.kind as "THEORY" | "PRACTICAL"}
            maxScore={assessment.maxScore}
            writtenQuestions={writtenQuestions}
            initialMarks={marks}
            initialScore={submission.score}
            initialFeedback={submission.feedback}
          />
        </div>
      </Card>
    </div>
  );
}
