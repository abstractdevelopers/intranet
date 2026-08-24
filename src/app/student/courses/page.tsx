import Link from "next/link";
import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { ButtonLink } from "@/components/ui/button";
import { CourseMark } from "@/components/course-mark";
import { ProgressRing } from "@/components/ui/progress-ring";
import { IconLock, IconClock } from "@/components/icons";
import { getCourseProgress } from "@/lib/progress";

export const metadata = { title: "My Courses" };

export default async function CoursesPage() {
  const user = await requireStudent();
  const enrollments = await db.enrollment.findMany({
    where: { userId: user.id },
    include: { course: true },
    orderBy: { createdAt: "asc" },
  });

  const accepted = enrollments.filter((e) => e.status === "ACCEPTED");
  const progress = await Promise.all(accepted.map((e) => getCourseProgress(user.id, e.courseId)));
  const progressByCourse = new Map(progress.map((p) => [p.courseId, p]));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="eyebrow">Learn</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">My Courses</h1>
        <p className="mt-1 text-sm text-text-muted">
          Your three-course academy program — two foundations and your chosen specialization.
        </p>
      </div>
      {enrollments.length === 0 ? (
        <EmptyState
          title="No courses yet"
          body="Complete your application to receive your academy program."
          action={<ButtonLink href="/student/apply">Start application</ButtonLink>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {enrollments.map((enrollment) => {
            const p = progressByCourse.get(enrollment.courseId);
            const accessible = enrollment.status === "ACCEPTED";
            return (
              <Card key={enrollment.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <CourseMark slug={enrollment.course.slug} />
                  <Badge tone={statusTone(enrollment.status)}>
                    {enrollment.status.toLowerCase()}
                  </Badge>
                </div>
                <h2 className="mt-3 text-sm font-semibold">{enrollment.course.name}</h2>
                <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-text-muted">
                  {enrollment.enrollmentType === "COMPULSORY" ? "Compulsory" : "Elective"}
                </p>
                <p className="mt-2 flex-1 text-sm text-text-muted">{enrollment.course.description}</p>
                {accessible ? (
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="text-xs text-text-muted">
                      <p>
                        {p?.completedModules ?? 0}/{p?.totalModules ?? 0} weeks ·{" "}
                        {p?.completedLessons ?? 0}/{p?.totalLessons ?? 0} lessons
                      </p>
                    </div>
                    <ProgressRing value={p?.percent ?? 0} size={48} stroke={4.5} />
                  </div>
                ) : (
                  <p className="mt-4 flex items-center gap-1.5 text-xs text-text-muted">
                    {enrollment.status === "PENDING" ? (
                      <>
                        <IconClock className="h-3.5 w-3.5" /> Awaiting academy review
                      </>
                    ) : (
                      <>
                        <IconLock className="h-3.5 w-3.5" /> Not accessible
                      </>
                    )}
                  </p>
                )}
                {accessible ? (
                  <Link
                    href={`/student/courses/${enrollment.courseId}`}
                    className="mt-4 block rounded-lg border border-brand-1/30 px-3 py-2 text-center text-sm font-medium text-brand-1 transition-colors hover:bg-brand-3/15 dark:text-brand-3"
                  >
                    Open course
                  </Link>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
