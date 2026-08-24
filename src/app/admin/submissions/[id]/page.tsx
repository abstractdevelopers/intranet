import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { ReviewForm } from "@/components/assignments/review-form";
import { formatDate } from "@/lib/format";

export default async function ReviewSubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const submission = await db.assignmentSubmission.findUnique({
    where: { id },
    include: {
      user: { include: { profile: true } },
      assignment: { include: { module: { include: { course: true } } } },
      files: { include: { document: true } },
      grade: { include: { gradedBy: { include: { profile: true } } } },
      feedback: { include: { author: { include: { profile: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!submission) notFound();

  const studentName = submission.user.profile?.fullName ?? submission.user.email;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav className="text-xs text-text-muted">
        <Link href="/admin/submissions" className="hover:text-brand-1">Submissions</Link>
        <span className="mx-2">/</span>
        <span className="text-text">Review</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Assignment submission</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{submission.assignment.title}</h1>
        </div>
        <Badge tone={statusTone(submission.status)}>{submission.status.replace(/_/g, " ")}</Badge>
      </header>

      <Card className="p-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold text-text-muted">Student</dt>
            <dd className="mt-0.5 font-medium">{studentName}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-text-muted">Course</dt>
            <dd className="mt-0.5 font-medium">{submission.assignment.module.course.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-text-muted">Module</dt>
            <dd className="mt-0.5 font-medium">Week {submission.assignment.module.weekNumber}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-text-muted">Submitted</dt>
            <dd className="mt-0.5 font-medium">{formatDate(submission.submittedAt)}</dd>
          </div>
        </dl>
      </Card>

      <Card className="p-6">
        <p className="eyebrow">Submission · attempt {submission.attempt}</p>
        <div className="mt-3 space-y-2 text-sm">
          {submission.files.map((f) => (
            <p key={f.id}>
              <a
                href={`/api/documents/${f.documentId}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-brand-1 underline-offset-2 hover:underline dark:text-brand-3"
              >
                Open: {f.fileName}
              </a>
              <span className="ml-2 text-xs text-text-muted">
                {(f.document.sizeBytes / 1024).toFixed(0)}KB
              </span>
            </p>
          ))}
          {submission.repoUrl ? (
            <p>
              <a href={submission.repoUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-1 underline-offset-2 hover:underline dark:text-brand-3">
                {submission.repoUrl}
              </a>
            </p>
          ) : null}
          {submission.externalUrl ? (
            <p>
              <a href={submission.externalUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-1 underline-offset-2 hover:underline dark:text-brand-3">
                {submission.externalUrl}
              </a>
            </p>
          ) : null}
          {submission.textContent ? (
            <p className="whitespace-pre-wrap rounded-lg bg-surface-2 p-3">{submission.textContent}</p>
          ) : null}
        </div>
      </Card>

      {submission.grade ? (
        <Card className="p-6">
          <p className="eyebrow">Current grade</p>
          <p className="mt-2 text-2xl font-bold text-brand-1 dark:text-brand-3">
            {submission.grade.score} / {submission.grade.maxScore}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Graded by {submission.grade.gradedBy.profile?.fullName ?? submission.grade.gradedBy.email} ·{" "}
            {formatDate(submission.grade.gradedAt)}
          </p>
        </Card>
      ) : null}

      {submission.feedback.length > 0 ? (
        <Card className="p-6">
          <p className="eyebrow">Feedback history</p>
          <ul className="mt-3 space-y-3">
            {submission.feedback.map((f) => (
              <li key={f.id} className="border-l-2 border-brand-1/40 pl-3 text-sm">
                <p>{f.body}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {f.author.profile?.fullName ?? f.author.email} · {formatDate(f.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="p-6">
        <p className="eyebrow">Your review</p>
        <div className="mt-4">
          <ReviewForm submissionId={submission.id} maxScore={submission.assignment.maxScore} />
        </div>
      </Card>
    </div>
  );
}
