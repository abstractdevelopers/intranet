import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { CourseMark } from "@/components/course-mark";
import { IconAssignments, IconCheckCircle, IconPlay } from "@/components/icons";

export default async function ModulePage({
  params,
}: {
  params: Promise<{ courseId: string; moduleId: string }>;
}) {
  const { courseId, moduleId } = await params;
  const user = await requireStudent();

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    include: { course: true },
  });
  if (!enrollment) notFound();
  if (enrollment.status !== "ACCEPTED") redirect("/student/courses");

  const mod = await db.module.findFirst({
    where: { id: moduleId, courseId, status: "PUBLISHED" },
    include: {
      lessons: {
        orderBy: { order: "asc" },
        include: { progress: { where: { userId: user.id } } },
      },
      assignments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!mod) notFound();

  // Enforce the same access rules as the course page: release date + sequential completion.
  if (mod.releaseAt && mod.releaseAt > new Date()) redirect(`/student/courses/${courseId}`);
  const previous = await db.module.findMany({
    where: { courseId, status: "PUBLISHED", order: { lt: mod.order } },
    include: { lessons: { include: { progress: { where: { userId: user.id } } } } },
    orderBy: { order: "asc" },
  });
  const blocked = previous.some((m) => {
    const ids = m.lessons;
    return ids.length > 0 && ids.some((l) => !l.progress[0]?.completedAt);
  });
  if (blocked) redirect(`/student/courses/${courseId}`);

  const doneLessons = mod.lessons.filter((l) => l.progress[0]?.completedAt).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav className="text-xs text-text-muted">
        <Link href="/student/courses" className="hover:text-brand-1">My Courses</Link>
        <span className="mx-2">/</span>
        <Link href={`/student/courses/${courseId}`} className="hover:text-brand-1">
          {enrollment.course.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-text">Week {mod.weekNumber}</span>
      </nav>

      <section className="hero-band rounded-2xl p-6 md:p-8">
        <div className="relative flex items-center gap-4">
          <CourseMark slug={enrollment.course.slug} size="md" />
          <div>
            <p className="hero-eyebrow text-[11px] font-semibold uppercase tracking-[0.18em]">
              Week {String(mod.weekNumber).padStart(2, "0")} · {enrollment.course.name}
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight">{mod.title}</h1>
            {mod.overview ? <p className="hero-muted mt-1 text-sm">{mod.overview}</p> : null}
          </div>
        </div>
      </section>

      {mod.objectives ? (
        <Card className="p-5">
          <p className="eyebrow">Learning objectives</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-muted">{mod.objectives}</p>
        </Card>
      ) : null}

      <section>
        <div className="flex items-center justify-between">
          <p className="eyebrow">Lessons</p>
          <span className="text-xs font-medium text-text-muted">
            {doneLessons}/{mod.lessons.length} complete
          </span>
        </div>
        {mod.lessons.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No lessons yet" body="Lessons for this week will appear here." />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {mod.lessons.map((lesson) => {
              const done = Boolean(lesson.progress[0]?.completedAt);
              return (
                <li key={lesson.id}>
                  <Link
                    href={`/student/courses/${courseId}/modules/${mod.id}/lessons/${lesson.id}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 transition-colors hover:border-brand-1/40"
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        done
                          ? "bg-brand-1 text-white"
                          : "bg-brand-3/25 text-brand-1 dark:text-brand-3"
                      }`}
                    >
                      {done ? (
                        <IconCheckCircle className="h-5 w-5" />
                      ) : (
                        <IconPlay className="h-5 w-5" />
                      )}
                    </span>
                    <span className="flex-1">
                      <span className={`block text-sm font-semibold ${done ? "text-text-muted" : ""}`}>
                        {lesson.title}
                      </span>
                      {lesson.durationMin ? (
                        <span className="text-xs text-text-muted">{lesson.durationMin} min</span>
                      ) : null}
                    </span>
                    {done ? (
                      <span className="text-xs font-semibold text-brand-1 dark:text-brand-3">Done</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {mod.assignments.length > 0 ? (
        <section>
          <p className="eyebrow">Assignments</p>
          <ul className="mt-3 space-y-2">
            {mod.assignments.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/student/assignments/${a.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 transition-colors hover:border-brand-1/40"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-3/25 text-brand-1 dark:text-brand-3">
                    <IconAssignments className="h-5 w-5" />
                  </span>
                  <span className="flex-1 text-sm font-semibold">{a.title}</span>
                  <span className="text-xs text-text-muted">{a.maxScore} pts</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
