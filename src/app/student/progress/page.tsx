import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { ButtonLink } from "@/components/ui/button";
import { CourseMark } from "@/components/course-mark";
import { ProgressRing } from "@/components/ui/progress-ring";
import { IconMedal, IconCheck } from "@/components/icons";
import { getCourseProgress } from "@/lib/progress";
import { getMilestones } from "@/lib/milestones";

export const metadata = { title: "Progress" };

export default async function ProgressPage() {
  const user = await requireStudent();
  const enrollments = await db.enrollment.findMany({
    where: { userId: user.id, status: "ACCEPTED" },
    include: { course: true },
    orderBy: { createdAt: "asc" },
  });

  const progress = await Promise.all(
    enrollments.map((e) => getCourseProgress(user.id, e.courseId))
  );
  const milestones = await getMilestones(user.id);
  const overall =
    progress.length === 0
      ? 0
      : Math.round(progress.reduce((sum, p) => sum + p.percent, 0) / progress.length);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="eyebrow">Progress</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Your Progress</h1>
        <p className="mt-1 text-sm text-text-muted">
          Every lesson, week and milestone — tracked across your program.
        </p>
      </div>

      {progress.length === 0 ? (
        <EmptyState
          title="No active courses yet"
          body="Once your courses are active, your progress will be tracked here."
          action={<ButtonLink href="/student/apply">View application</ButtonLink>}
        />
      ) : (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-6 p-6">
            <div>
              <p className="eyebrow">Overall program</p>
              <p className="mt-2 max-w-md text-sm text-text-muted">
                Average completion across your {progress.length} active course
                {progress.length === 1 ? "" : "s"}.
              </p>
            </div>
            <ProgressRing value={overall} size={88} stroke={7} />
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            {progress.map((p) => {
              const course = enrollments.find((e) => e.courseId === p.courseId)?.course;
              return (
                <Card key={p.courseId} className="p-5">
                  <div className="flex items-center justify-between">
                    <CourseMark slug={course?.slug ?? ""} />
                    <ProgressRing value={p.percent} size={52} stroke={5} />
                  </div>
                  <h2 className="mt-3 text-sm font-semibold">{course?.name}</h2>
                  <dl className="mt-3 space-y-1.5 text-sm text-text-muted">
                    <div className="flex justify-between">
                      <dt>Weeks</dt>
                      <dd>
                        {p.completedModules}/{p.totalModules}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Lessons</dt>
                      <dd>
                        {p.completedLessons}/{p.totalLessons}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Assignments</dt>
                      <dd>
                        {p.submittedAssignments}/{p.totalAssignments}
                      </dd>
                    </div>
                  </dl>
                </Card>
              );
            })}
          </div>

          <section aria-label="Milestones">
            <p className="eyebrow">Milestones</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">Achievements</h2>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {milestones.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl border p-3.5 text-center ${
                    m.achieved
                      ? "border-brand-1/30 bg-brand-3/15"
                      : "border-dashed border-border bg-surface opacity-60"
                  }`}
                >
                  <span
                    className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full ${
                      m.achieved
                        ? "bg-brand-1 text-white"
                        : "border border-dashed border-border text-text-muted"
                    }`}
                  >
                    {m.achieved ? <IconCheck className="h-4.5 w-4.5" /> : <IconMedal className="h-4.5 w-4.5" />}
                  </span>
                  <p className="mt-2 text-xs font-semibold">{m.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-text-muted">{m.description}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
