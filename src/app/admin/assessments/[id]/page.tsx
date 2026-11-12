import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { QuestionEditor } from "@/components/admin/question-editor";
import { AssessmentSettingsForm } from "@/components/admin/assessment-settings-form";
import { PATHWAY_LABELS, type Pathway } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Assessment editor" };

/** A paper's settings, its questions, and every submission to mark. */
export default async function AdminAssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const assessment = await db.assessment.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } },
      submissions: {
        orderBy: { submittedAt: "desc" },
        include: { user: { include: { profile: true } } },
      },
    },
  });
  if (!assessment) notFound();

  const graded = assessment.submissions.filter((s) => s.status === "GRADED").length;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <nav className="text-xs text-text-muted">
        <Link href="/admin/assessments" className="hover:text-brand-1">
          Assessments
        </Link>
        <span className="mx-2">/</span>
        <span className="text-text">Editor</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{assessment.kind === "THEORY" ? "Theory paper" : "Practical paper"}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{assessment.title}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {assessment.pathway ? PATHWAY_LABELS[assessment.pathway as Pathway] : "All pathways"} ·{" "}
            {assessment.questions.length} question{assessment.questions.length === 1 ? "" : "s"}
          </p>
        </div>
        <Badge tone={statusTone(assessment.status)}>{assessment.status.toLowerCase()}</Badge>
      </header>

      <section>
        <p className="eyebrow">01 — Settings</p>
        <Card className="mt-4">
          <AssessmentSettingsForm
            id={assessment.id}
            initial={{
              title: assessment.title,
              description: assessment.description ?? "",
              instructions: assessment.instructions ?? "",
              pathway: assessment.pathway ?? "",
              openAt: assessment.openAt ? assessment.openAt.toISOString() : "",
              closeAt: assessment.closeAt ? assessment.closeAt.toISOString() : "",
              maxScore: assessment.maxScore,
              passMark: assessment.passMark,
              status: assessment.status,
            }}
          />
        </Card>
      </section>

      <section>
        <p className="eyebrow">02 — Questions</p>
        <p className="mt-1 text-sm text-text-muted">
          {assessment.kind === "THEORY"
            ? "Multiple-choice questions are graded automatically. Written questions are marked by hand."
            : "A practical paper has no questions — students submit a deliverable you mark out of " +
              assessment.maxScore +
              "."}
        </p>
        {assessment.kind === "THEORY" ? (
          <div className="mt-4">
            <QuestionEditor
              assessmentId={assessment.id}
              initial={assessment.questions.map((q) => ({
                id: q.id,
                kind: q.kind,
                prompt: q.prompt,
                explanation: q.explanation,
                points: q.points,
                options: q.options.map((o) => ({ label: o.label, isCorrect: o.isCorrect })),
              }))}
            />
          </div>
        ) : null}
      </section>

      <section>
        <p className="eyebrow">03 — Submissions</p>
        <p className="mt-1 text-sm text-text-muted">
          {assessment.submissions.length} submitted · {graded} marked
        </p>
        <div className="mt-4 space-y-2">
          {assessment.submissions.length === 0 ? (
            <EmptyState title="No submissions yet" body="Student submissions will appear here as they come in." />
          ) : (
            assessment.submissions.map((s) => (
              <Link
                key={s.id}
                href={`/admin/assessments/${assessment.id}/submissions/${s.id}`}
                className="block"
              >
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:border-brand-1/40">
                  <div>
                    <p className="text-sm font-semibold">
                      {s.user.profile?.fullName ?? s.user.email}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      Submitted {formatDateTime(s.submittedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={statusTone(s.status)}>{s.status.toLowerCase()}</Badge>
                    {s.score !== null ? (
                      <span className="text-sm font-semibold">{Math.round(s.score)}%</span>
                    ) : s.autoScore !== null ? (
                      <span className="text-xs text-text-muted">MCQ {Math.round(s.autoScore)}%</span>
                    ) : null}
                  </div>
                </Card>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
