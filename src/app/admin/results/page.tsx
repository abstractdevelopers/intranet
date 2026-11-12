import Link from "next/link";
import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { ReleasePanel } from "@/components/admin/release-panel";
import { WeightsForm } from "@/components/admin/weights-form";
import { DEFAULT_ASSESSMENT_WEIGHTS, type ResultBand } from "@/lib/constants";

export const metadata = { title: "Results" };

const BAND_TONE: Record<string, "success" | "warning" | "danger"> = {
  DISTINCTION: "success",
  PROGRESS: "warning",
  FAIL: "danger",
};

const BAND_LABEL: Record<string, string> = {
  DISTINCTION: "70-100%",
  PROGRESS: "50-69%",
  FAIL: "Below 50%",
};

function pct(v: number | null) {
  return v === null ? "—" : `${Math.round(v)}%`;
}

/**
 * Results dashboard.
 *
 * Every student's collated score, their component breakdown, and the controls
 * that recalculate, weight, and release. Results are hidden from students until
 * released; this page is where staff review them first.
 */
export default async function AdminResultsPage() {
  await requireStaff();

  const [config, results, studentCount] = await Promise.all([
    db.assessmentConfig.findUnique({ where: { id: "global" } }),
    db.studentResult.findMany({
      include: { user: { include: { profile: true } } },
      orderBy: { overallPercent: "desc" },
      take: 500,
    }),
    db.user.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
  ]);

  const weights = config ?? {
    id: "global",
    assignmentWeight: DEFAULT_ASSESSMENT_WEIGHTS.assignment,
    theoryWeight: DEFAULT_ASSESSMENT_WEIGHTS.theory,
    practicalWeight: DEFAULT_ASSESSMENT_WEIGHTS.practical,
    updatedById: null,
    updatedAt: new Date(),
  };
  const released = results.filter((r) => r.emailSentAt !== null).length;

  const bandCounts = {
    FAIL: results.filter((r) => r.band === "FAIL").length,
    PROGRESS: results.filter((r) => r.band === "PROGRESS").length,
    DISTINCTION: results.filter((r) => r.band === "DISTINCTION").length,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="eyebrow">Academy</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Results</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Every student&rsquo;s overall score, combining their assignment average with their theory and
          practical assessments. The overall figure is always a percentage out of 100 — it can never exceed
          100% however much work a student completes.
        </p>
      </header>

      <section>
        <p className="eyebrow">01 — Release</p>
        <Card className="mt-4">
          <ReleasePanel total={studentCount} released={released} />
        </Card>
      </section>

      <section>
        <p className="eyebrow">02 — Grading weights</p>
        <p className="mt-1 text-sm text-text-muted">
          How the three components combine. Weights re-normalise over whatever a student has, so a student
          is never penalised for a component they were not given.
        </p>
        <Card className="mt-4">
          <WeightsForm
            initial={{
              assignmentWeight: weights.assignmentWeight,
              theoryWeight: weights.theoryWeight,
              practicalWeight: weights.practicalWeight,
            }}
          />
        </Card>
      </section>

      {results.length > 0 ? (
        <section>
          <p className="eyebrow">03 — Distribution</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {(["DISTINCTION", "PROGRESS", "FAIL"] as ResultBand[]).map((band) => (
              <Card key={band} className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-text-muted">{BAND_LABEL[band]}</p>
                  <Badge tone={BAND_TONE[band]}>{band.toLowerCase()}</Badge>
                </div>
                <p className="mt-2 text-3xl font-bold">{bandCounts[band]}</p>
                <p className="text-xs text-text-muted">students</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <p className="eyebrow">{results.length > 0 ? "04" : "03"} — Student results</p>
        <p className="mt-1 text-sm text-text-muted">
          {results.length === 0
            ? "No results calculated yet. Click “Recalculate scores” above once marking is complete."
            : `${results.length} of ${studentCount} students. Sorted by overall score.`}
        </p>
        <div className="mt-4">
          {results.length === 0 ? (
            <EmptyState
              title="No results yet"
              body="Once assignments and assessments are marked, recalculate to collate each student's score."
            />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 text-right font-semibold">Assign.</th>
                    <th className="px-4 py-3 text-right font-semibold">Theory</th>
                    <th className="px-4 py-3 text-right font-semibold">Practical</th>
                    <th className="px-4 py-3 text-right font-semibold">Overall</th>
                    <th className="px-4 py-3 font-semibold">Released</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/students/${r.userId}`}
                          className="font-medium hover:text-brand-1 dark:hover:text-brand-3"
                        >
                          {r.user.profile?.fullName ?? r.user.email}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-text-muted">
                        {pct(r.assignmentPercent)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-text-muted">
                        {pct(r.theoryPercent)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-text-muted">
                        {pct(r.practicalPercent)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold tabular-nums">{Math.round(r.overallPercent)}%</span>
                      </td>
                      <td className="px-4 py-3">
                        {r.emailSentAt ? (
                          <Badge tone="success">sent</Badge>
                        ) : r.released ? (
                          <Badge tone="warning">released</Badge>
                        ) : (
                          <Badge tone="neutral">hidden</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
