import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty";
import { getCourseProgress } from "@/lib/progress";

export const metadata = { title: "Progress" };

export default async function ProgressPage() {
  const user = await requireStudent();
  const enrollments = await db.enrollment.findMany({
    where: { userId: user.id, status: "ACCEPTED" },
    include: { course: true },
  });

  const progress = await Promise.all(
    enrollments.map((e) => getCourseProgress(user.id, e.courseId))
  );

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
      <div className="mt-6 space-y-4">
        {progress.length === 0 ? (
          <EmptyState title="No progress yet" body="Your progress will appear here once you start learning." />
        ) : (
          progress.map((p) => {
            const course = enrollments.find((e) => e.courseId === p.courseId)?.course;
            return (
              <Card key={p.courseId}>
                <h2 className="text-base font-semibold">{course?.name}</h2>
                <div className="mt-4 grid gap-4 text-sm text-text-muted md:grid-cols-3">
                  <p>Modules: <span className="font-medium text-text">{p.completedModules} / {p.totalModules}</span></p>
                  <p>Lessons: <span className="font-medium text-text">{p.completedLessons} / {p.totalLessons}</span></p>
                  <p>Assignments: <span className="font-medium text-text">{p.submittedAssignments} / {p.totalAssignments}</span></p>
                </div>
                <div className="mt-4">
                  <ProgressBar value={p.percent} label="Overall progress" />
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
