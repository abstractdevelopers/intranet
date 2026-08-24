import Link from "next/link";
import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Submissions" };

export default async function SubmissionsPage() {
  await requireStaff();
  const submissions = await db.assignmentSubmission.findMany({
    include: {
      user: { include: { profile: true } },
      assignment: { include: { module: { include: { course: true } } } },
      grade: true,
    },
    orderBy: { submittedAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight">Submissions</h1>
      <div className="mt-6 space-y-3">
        {submissions.length === 0 ? (
          <EmptyState title="No submissions yet" body="Student submissions awaiting review will appear here." />
        ) : (
          submissions.map((s) => (
            <Link key={s.id} href={`/admin/submissions/${s.id}`} className="block">
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:border-brand-1/40">
              <div>
                <p className="text-sm font-semibold">{s.assignment.title}</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {s.user.profile?.fullName ?? s.user.email} · {s.assignment.module.course.name} · Week{" "}
                  {s.assignment.module.weekNumber} · Submitted {formatDateTime(s.submittedAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={statusTone(s.status)}>{s.status.replaceAll("_", " ").toLowerCase()}</Badge>
                {s.grade ? <span className="text-sm font-semibold">{s.grade.score} / {s.grade.maxScore}</span> : null}
              </div>
            </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
