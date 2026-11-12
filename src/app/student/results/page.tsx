import Link from "next/link";
import { requireOnboardedStudent } from "@/lib/rbac";
import { getReleasedResult } from "@/lib/results";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { ProgressRing } from "@/components/ui/progress-ring";
import { IconArrowRight } from "@/components/icons";

export const metadata = { title: "Results" };

const BAND_LABEL: Record<string, string> = {
  FAIL: "Needs improvement",
  PROGRESS: "Good progress",
  DISTINCTION: "Distinction",
};

function tone(band: string) {
  if (band === "DISTINCTION") return "success" as const;
  if (band === "PROGRESS") return "warning" as const;
  return "danger" as const;
}

/**
 * The student's released end-of-term result.
 *
 * Gated on `StudentResult.released`: until staff release results, the student
 * sees nothing here — not even a placeholder score. Their component breakdown
 * is shown once released, and the same figures were emailed to them.
 */
export default async function StudentResultsPage() {
  const user = await requireOnboardedStudent();
  const result = await getReleasedResult(user.id);

  if (!result) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <p className="eyebrow">End-of-term</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Your Result</h1>
        </header>
        <EmptyState
          title="Your result hasn't been released yet."
          body="Once your assignments and assessments have been marked and reviewed, your result will appear here and be emailed to you."
        />
        <p className="text-sm text-text-muted">
          In the meantime, you can review your{" "}
          <Link href="/student/assessments" className="text-brand-1 hover:underline dark:text-brand-3">
            assessments
          </Link>{" "}
          and{" "}
          <Link href="/student/scores" className="text-brand-1 hover:underline dark:text-brand-3">
            scores
          </Link>
          .
        </p>
      </div>
    );
  }

  const rows = [
    { label: "Assignments", value: result.assignmentPercent },
    { label: "Theory assessment", value: result.theoryPercent },
    { label: "Practical assessment", value: result.practicalPercent },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="eyebrow">End-of-term</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Your Result</h1>
        <p className="mt-1.5 text-sm text-text-muted">
          Your overall score for the term, combining your assignments, theory and practical assessments.
        </p>
      </header>

      <Card className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="text-sm text-text-muted">Overall score</p>
          <p className="mt-1 text-4xl font-bold tracking-tight">{Math.round(result.overallPercent)}%</p>
          <Badge tone={tone(result.band)} className="mt-2">
            {BAND_LABEL[result.band] ?? result.band}
          </Badge>
        </div>
        <ProgressRing value={result.overallPercent} size={104} stroke={8} />
      </Card>

      <section aria-label="Breakdown">
        <p className="eyebrow">Breakdown</p>
        <Card className="mt-4 p-0">
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-border last:border-0">
                  <td className="px-5 py-4 text-text-muted">{r.label}</td>
                  <td className="px-5 py-4 text-right font-semibold tabular-nums">
                    {r.value === null ? "—" : `${Math.round(r.value)}%`}
                  </td>
                </tr>
              ))}
              <tr className="bg-surface-2">
                <td className="px-5 py-4 font-semibold">Overall</td>
                <td className="px-5 py-4 text-right text-lg font-bold tabular-nums text-brand-1 dark:text-brand-3">
                  {Math.round(result.overallPercent)}%
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
        <p className="mt-2 text-xs text-text-muted">
          A dash means that component carries no mark. Your overall score is capped at 100%.
        </p>
      </section>

      <div className="border-t border-border pt-5">
        <Link
          href="/student/assessments"
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-1 hover:underline dark:text-brand-3"
        >
          Back to assessments <IconArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
