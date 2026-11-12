import Link from "next/link";
import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { IconArrowRight } from "@/components/icons";
import { AssessmentCreateForm } from "@/components/admin/assessment-create-form";
import { PATHWAY_LABELS, type Pathway } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Assessments" };

/**
 * The end-of-term papers, by kind and pathway. Each row opens the editor where
 * questions are set and submissions are marked.
 */
export default async function AdminAssessmentsPage() {
  await requireStaff();

  const assessments = await db.assessment.findMany({
    orderBy: [{ kind: "asc" }, { pathway: "asc" }],
    include: {
      _count: { select: { questions: true, submissions: true } },
      submissions: { select: { status: true } },
    },
  });

  const byKind = new Map<string, typeof assessments>();
  for (const a of assessments) {
    byKind.set(a.kind, [...(byKind.get(a.kind) ?? []), a]);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="eyebrow">Teach</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Assessments</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          One theory paper and one practical paper per pathway. Open both on Thursday, close on
          Saturday at 2:00 PM WAT. Set the questions here, then mark submissions.
        </p>
      </header>

      <AssessmentCreateForm />

      {assessments.length === 0 ? (
        <EmptyState
          title="No assessments yet"
          body="Create the theory and practical papers for each pathway above, then add their questions."
        />
      ) : (
        (["THEORY", "PRACTICAL"] as const).map((kind) => {
          const list = byKind.get(kind) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={kind}>
              <p className="eyebrow">{kind === "THEORY" ? "Theory papers" : "Practical papers"}</p>
              <ul className="mt-3 space-y-2">
                {list.map((a) => {
                  const graded = a.submissions.filter((s) => s.status === "GRADED").length;
                  return (
                    <li key={a.id}>
                      <Link href={`/admin/assessments/${a.id}`} className="block">
                        <Card className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:border-brand-1/40">
                          <div>
                            <p className="text-sm font-semibold">{a.title}</p>
                            <p className="mt-0.5 text-xs text-text-muted">
                              {a.pathway ? PATHWAY_LABELS[a.pathway as Pathway] : "All pathways"} ·{" "}
                              {a._count.questions} question{a._count.questions === 1 ? "" : "s"} · closes{" "}
                              {formatDateTime(a.closeAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge tone={a.status === "PUBLISHED" ? "success" : "warning"}>
                              {a.status.toLowerCase()}
                            </Badge>
                            <Badge tone="neutral">
                              {a._count.submissions} submission{a._count.submissions === 1 ? "" : "s"}
                              {a._count.submissions > 0 ? ` · ${graded} marked` : ""}
                            </Badge>
                            <IconArrowRight className="h-4 w-4 text-text-muted" />
                          </div>
                        </Card>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
