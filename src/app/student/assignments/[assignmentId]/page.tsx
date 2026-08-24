import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { SubmissionForm } from "@/components/assignments/submission-form";
import { formatDate } from "@/lib/format";

function parseAllowed(raw: string): string[] {
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p.map(String);
  } catch {
    /* fall through */
  }
  return raw.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
}

const STATUS_TONE: Record<string, "warning" | "danger" | "success"> = {
  SUBMITTED: "warning",
  RESUBMITTED: "warning",
  NEEDS_REVISION: "danger",
  GRADED: "success",
};

export default async function AssignmentPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const user = await requireStudent();

  const assignment = await db.assignment.findFirst({
    where: { id: assignmentId, module: { status: "PUBLISHED" } },
    include: { module: { include: { course: { select: { id: true, name: true, slug: true } } } } },
  });
  if (!assignment) notFound();

  const enrollment = await db.enrollment.findFirst({
    where: { userId: user.id, courseId: assignment.module.course.id, status: "ACCEPTED" },
    select: { id: true },
  });
  if (!enrollment) redirect("/student/courses");

  const submissions = await db.assignmentSubmission.findMany({
    where: { assignmentId, userId: user.id },
    include: {
      files: { include: { document: true } },
      grade: { include: { gradedBy: { select: { email: true } } } },
      feedback: { include: { author: { select: { email: true } } }, orderBy: { createdAt: "desc" } },
    },
    orderBy: { attempt: "desc" },
  });

  const allowed = parseAllowed(assignment.allowedTypes);
  const attemptsLeft = assignment.maxAttempts - submissions.length;
  const late = assignment.deadline ? new Date() > assignment.deadline : false;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav className="text-xs text-text-muted">
        <Link href={`/student/courses/${assignment.module.course.id}`} className="hover:text-brand-1">
          {assignment.module.course.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-text">Week {assignment.module.weekNumber} · {assignment.title}</span>
      </nav>

      <section className="hero-band rounded-2xl p-6 md:p-8">
        <p className="hero-eyebrow text-[11px] font-semibold uppercase tracking-[0.18em]">Assignment</p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight">{assignment.title}</h1>
        <div className="hero-muted mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span>{assignment.maxScore} points</span>
          {assignment.deadline ? (
            <span className={late ? "font-semibold text-red-300" : ""}>
              Due {formatDate(assignment.deadline)}
            </span>
          ) : (
            <span>No deadline</span>
          )}
          <span>{assignment.maxAttempts} attempt{assignment.maxAttempts === 1 ? "" : "s"} allowed</span>
        </div>
      </section>

      <Card className="space-y-4 p-6">
        <div>
          <p className="eyebrow">Brief</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{assignment.description}</p>
        </div>
        {assignment.instructions ? (
          <div>
            <p className="eyebrow">Instructions</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-muted">{assignment.instructions}</p>
          </div>
        ) : null}
        {assignment.requirements ? (
          <div>
            <p className="eyebrow">Requirements</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-muted">{assignment.requirements}</p>
          </div>
        ) : null}
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Your submission</p>
          <span className="text-xs text-text-muted">Accepted: {allowed.join(", ")}</span>
        </div>
        <div className="mt-4">
          <SubmissionForm
            assignmentId={assignment.id}
            allowedTypes={allowed}
            maxFileSizeMb={assignment.maxFileSizeMb}
            attemptsLeft={attemptsLeft}
          />
        </div>
      </Card>

      {submissions.length > 0 ? (
        <section>
          <p className="eyebrow">Submission history</p>
          <ul className="mt-3 space-y-3">
            {submissions.map((sub) => (
              <li key={sub.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">Attempt {sub.attempt}</span>
                      <Badge tone={STATUS_TONE[sub.status] ?? statusTone(sub.status)}>
                        {sub.status.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                    </div>
                    <span className="text-xs text-text-muted">{formatDate(sub.submittedAt)}</span>
                  </div>

                  <div className="mt-3 space-y-1.5 text-sm text-text-muted">
                    {sub.files.map((f) => (
                      <p key={f.id}>
                        <a
                          href={`/api/documents/${f.documentId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-1 underline-offset-2 hover:underline dark:text-brand-3"
                        >
                          {f.fileName}
                        </a>
                      </p>
                    ))}
                    {sub.repoUrl ? <p className="break-all">{sub.repoUrl}</p> : null}
                    {sub.externalUrl ? <p className="break-all">{sub.externalUrl}</p> : null}
                    {sub.textContent ? (
                      <p className="whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-text">{sub.textContent}</p>
                    ) : null}
                  </div>

                  {sub.grade ? (
                    <div className="mt-4 rounded-lg border border-brand-1/20 bg-brand-3/10 p-4">
                      <p className="text-lg font-bold text-brand-1 dark:text-brand-3">
                        {sub.grade.score} / {sub.grade.maxScore}
                        <span className="ml-2 text-xs font-semibold uppercase tracking-wide">
                          {sub.grade.passed ? "Passed" : "Not passed"}
                        </span>
                      </p>
                    </div>
                  ) : null}

                  {sub.feedback.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {sub.feedback.map((f) => (
                        <blockquote
                          key={f.id}
                          className="border-l-2 border-brand-1/40 pl-3 text-sm text-text-muted"
                        >
                          {f.body}
                        </blockquote>
                      ))}
                    </div>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
