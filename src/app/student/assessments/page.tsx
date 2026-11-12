import Link from "next/link";
import { requireOnboardedStudent } from "@/lib/rbac";
import { getStudentAssessments } from "@/lib/assessments";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { AssessmentCountdown } from "@/components/assessments/assessment-countdown";
import { IconArrowRight, IconTarget, IconCheckCircle } from "@/components/icons";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Assessments" };

function statusBadge(a: {
  window: { closed: boolean; upcoming: boolean };
  submission: { status: string; score: number | null } | null;
}) {
  if (a.submission?.status === "GRADED") return { tone: "success" as const, label: "Marked" };
  if (a.submission) return { tone: "brand" as const, label: "Submitted" };
  if (a.window.upcoming) return { tone: "warning" as const, label: "Opens Thursday" };
  if (a.window.closed) return { tone: "danger" as const, label: "Closed" };
  return { tone: "neutral" as const, label: "Not started" };
}

/**
 * The student's two end-of-term papers. Each links to its own page; the index
 * only reports state, so nothing here can start a paper early.
 */
export default async function StudentAssessmentsPage() {
  const user = await requireOnboardedStudent();
  const { theory, practical } = await getStudentAssessments(user.id);

  const papers = [
    { href: theory ? `/student/assessments/theory/${theory.id}` : null, label: "Theory assessment", data: theory },
    {
      href: practical ? `/student/assessments/practical/${practical.id}` : null,
      label: "Practical assessment",
      data: practical,
    },
  ].filter((p) => p.data);

  const closesAt = theory?.window.closesAt ?? practical?.window.closesAt ?? null;
  const anyUpcoming = Boolean(theory?.window.upcoming || practical?.window.upcoming);
  const allClosed = Boolean(
    (theory ? theory.window.closed : true) && (practical ? practical.window.closed : true),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <p className="eyebrow">End-of-term</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Your Assessments</h1>
        <p className="mt-1.5 text-sm text-text-muted">
          Two papers — one theory, one practical — matched to your pathway.{" "}
          {allClosed
            ? "The submission deadline has passed."
            : anyUpcoming
              ? "Both open on Thursday at 10:00 AM WAT and close on Saturday at 2:00 PM WAT."
              : "Both are open now and close on Saturday at 2:00 PM WAT."}
        </p>
      </header>

      {closesAt ? (
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-3/25 text-brand-1 dark:text-brand-3">
              <IconTarget className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Final deadline</p>
              <p className="text-xs text-text-muted">{formatDateTime(closesAt)}</p>
            </div>
          </div>
          <AssessmentCountdown closesAt={closesAt.toISOString()} />
        </Card>
      ) : null}

      {papers.length === 0 ? (
        <EmptyState
          title="Your assessments aren't available yet."
          body="They will appear here as soon as the academy publishes them."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {papers.map(({ href, label, data }) => {
            if (!data) return null;
            const badge = statusBadge(data);
            return (
              <Link key={label} href={href!} className="block">
                <Card className="h-full transition-colors hover:border-brand-1/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="eyebrow">{label}</p>
                      <p className="mt-1 text-sm font-semibold">{data.title}</p>
                    </div>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </div>
                  {data.submission?.score !== null && data.submission?.score !== undefined ? (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-success">
                      <IconCheckCircle className="h-4 w-4" /> {Math.round(data.submission.score)}%
                    </p>
                  ) : data.window.upcoming ? (
                    <p className="mt-3 text-xs text-text-muted">
                      {data.kind === "THEORY"
                        ? `${data.totalPoints} marks · opens Thursday`
                        : `Marked out of ${data.maxScore} · opens Thursday`}
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-text-muted">
                      {data.kind === "THEORY"
                        ? `${data.questions.length} question${data.questions.length === 1 ? "" : "s"} · ${data.totalPoints} marks`
                        : `Marked out of ${data.maxScore}`}
                    </p>
                  )}
                  <p className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-1 dark:text-brand-3">
                    {data.submission ? "Review" : "Begin"} <IconArrowRight className="h-3.5 w-3.5" />
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
