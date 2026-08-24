import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty";
import { getCourseProgress } from "@/lib/progress";

export const metadata = { title: "My Courses" };

export default async function CoursesPage() {
  const user = await requireStudent();
  const enrollments = await db.enrollment.findMany({
    where: { userId: user.id },
    include: { course: true },
    orderBy: { createdAt: "asc" },
  });

  if (enrollments.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold tracking-tight">My Courses</h1>
        <div className="mt-6">
          <EmptyState
            title="No courses yet"
            body="Complete your academy application to unlock your courses."
          />
          <ButtonLink href="/student/apply" className="mt-4">Apply to the academy</ButtonLink>
        </div>
      </div>
    );
  }

  const progress = await Promise.all(
    enrollments.map((e) => getCourseProgress(user.id, e.courseId))
  );
  const byCourse = new Map(progress.map((p) => [p.courseId, p]));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight">My Courses</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {enrollments.map((enrollment) => {
          const p = byCourse.get(enrollment.courseId);
          const accessible = enrollment.status === "ACCEPTED";
          return (
            <Card key={enrollment.id}>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold">{enrollment.course.name}</h2>
                <Badge tone={statusTone(enrollment.status)}>{enrollment.status.toLowerCase()}</Badge>
              </div>
              <p className="mt-1 text-sm text-text-muted">{enrollment.course.description}</p>
              {accessible ? (
                <>
                  <div className="mt-4 space-y-2 text-sm text-text-muted">
                    <p>Modules: {p?.completedModules ?? 0} / {p?.totalModules ?? 0}</p>
                    <p>Lessons: {p?.completedLessons ?? 0} / {p?.totalLessons ?? 0}</p>
                    <p>Assignments: {p?.submittedAssignments ?? 0} / {p?.totalAssignments ?? 0}</p>
                  </div>
                  <div className="mt-4">
                    <ProgressBar value={p?.percent ?? 0} label="Progress" />
                  </div>
                  <ButtonLink href={`/student/courses/${enrollment.courseId}`} className="mt-4 w-full">
                    Open course
                  </ButtonLink>
                </>
              ) : (
                <p className="mt-4 text-sm text-text-muted">
                  {enrollment.status === "PENDING"
                    ? "Awaiting academy approval."
                    : "This course is not currently accessible."}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
