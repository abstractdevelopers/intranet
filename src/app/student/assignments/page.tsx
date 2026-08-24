import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Assignments" };

export default async function AssignmentsPage() {
  const user = await requireStudent();

  const enrollments = await db.enrollment.findMany({
    where: { userId: user.id, status: "ACCEPTED" },
    select: { courseId: true },
  });
  const courseIds = enrollments.map((e) => e.courseId);

  const assignments = courseIds.length
    ? await db.assignment.findMany({
        where: { module: { courseId: { in: courseIds }, status: "PUBLISHED" } },
        include: {
          module: { include: { course: true } },
          submissions: {
            where: { userId: user.id },
            orderBy: { submittedAt: "desc" },
            take: 1,
            include: { grade: true },
          },
        },
        orderBy: { deadline: "asc" },
      })
    : [];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight">Assignments</h1>
      <div className="mt-6 space-y-3">
        {assignments.length === 0 ? (
          <EmptyState
            title="You're all caught up."
            body="New assignments will appear here when they're released."
          />
        ) : (
          assignments.map((assignment) => {
            const latest = assignment.submissions[0];
            return (
              <Card key={assignment.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-sm font-semibold">{assignment.title}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {assignment.module.course.name} · Week {assignment.module.weekNumber} · Due{" "}
                    {formatDateTime(assignment.deadline)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {latest ? (
                    <>
                      <Badge tone={statusTone(latest.status)}>{latest.status.replaceAll("_", " ").toLowerCase()}</Badge>
                      {latest.grade ? (
                        <span className="text-sm font-semibold">
                          {latest.grade.score} / {latest.grade.maxScore}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <Badge tone="neutral">not submitted</Badge>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
