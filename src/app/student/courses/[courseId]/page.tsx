import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { CourseMark } from "@/components/course-mark";
import { ProgressRing } from "@/components/ui/progress-ring";
import { CrestBackground } from "@/components/crest";
import {
  IconCheck,
  IconCheckCircle,
  IconLock,
  IconPlay,
  IconAssignments,
  IconClock,
} from "@/components/icons";
import { getCourseProgress } from "@/lib/progress";
import { formatDate } from "@/lib/format";

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const user = await requireStudent();

  // Server-side authorization: only ACCEPTED enrollments may view content.
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    include: { course: true },
  });
  if (!enrollment) notFound();
  if (enrollment.status !== "ACCEPTED") redirect("/student/courses");

  const [modules, progress] = await Promise.all([
    db.module.findMany({
      where: { courseId, status: "PUBLISHED" },
      include: {
        lessons: {
          orderBy: { order: "asc" },
          include: {
            progress: { where: { userId: user.id } },
          },
        },
        assignments: true,
      },
      orderBy: { order: "asc" },
    }),
    getCourseProgress(user.id, courseId),
  ]);

  // Access model: scheduled release + sequential completion.
  // A module unlocks when its release date has passed AND the previous module is complete.
  const now = new Date();
  let previousComplete = true;
  const moduleStates = [];
  for (const mod of modules) {
    const released = !mod.releaseAt || mod.releaseAt <= now;
    const totalLessons = mod.lessons.length;
    const doneLessons = mod.lessons.filter((l) => l.progress[0]?.completedAt).length;
    const complete = totalLessons > 0 && doneLessons === totalLessons;
    const unlocked = released && previousComplete;
    if (!complete) previousComplete = false;
    moduleStates.push({ mod, released, complete, unlocked, doneLessons, totalLessons });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Course hero */}
      <section className="hero-band rounded-2xl p-6 md:p-8" aria-label="Course">
        <CrestBackground className="pointer-events-none absolute -right-10 -top-6 h-40 w-auto opacity-10" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <CourseMark slug={enrollment.course.slug} size="lg" />
            <div>
              <p className="hero-eyebrow text-[11px] font-semibold uppercase tracking-[0.18em]">
                {enrollment.course.type === "COMPULSORY" ? "Compulsory course" : "Elective course"}
              </p>
              <h1 className="mt-1.5 text-2xl font-bold tracking-tight md:text-3xl">
                {enrollment.course.name}
              </h1>
              <p className="hero-muted mt-1 max-w-lg text-sm">{enrollment.course.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <p className="font-medium text-white/80">
                {progress.completedModules} of {progress.totalModules} weeks
              </p>
              <p className="text-white/60">
                {progress.completedLessons} of {progress.totalLessons} lessons
              </p>
            </div>
            <ProgressRing value={progress.percent} size={76} stroke={6} />
          </div>
        </div>
      </section>

      {/* Curriculum journey */}
      <section aria-label="Curriculum">
        <p className="eyebrow">Curriculum</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight">Your weekly journey</h2>

        {moduleStates.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title="Content is on the way"
              body="Modules for this course will appear here once published."
            />
          </div>
        ) : (
          <ol className="relative mt-6 space-y-0 border-l-2 border-border pl-0">
            {moduleStates.map(({ mod, released, complete, unlocked, doneLessons, totalLessons }) => (
              <li key={mod.id} className="relative pb-6 pl-8 last:pb-0">
                {/* Timeline node */}
                <span
                  className={`absolute -left-[13px] top-5 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                    complete
                      ? "border-brand-1 bg-brand-1 text-white"
                      : unlocked
                        ? "border-brand-1 bg-surface text-brand-1 dark:border-brand-3 dark:text-brand-3"
                        : "border-border bg-surface-2 text-text-muted"
                  }`}
                  aria-hidden
                >
                  {complete ? (
                    <IconCheck className="h-3.5 w-3.5" />
                  ) : unlocked ? (
                    <IconPlay className="h-3.5 w-3.5" />
                  ) : (
                    <IconLock className="h-3 w-3" />
                  )}
                </span>

                <Card className={`p-5 ${unlocked ? "" : "opacity-70"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="eyebrow">Week {String(mod.weekNumber).padStart(2, "0")}</p>
                      <h3 className="mt-1 text-base font-semibold">{mod.title}</h3>
                      {mod.overview ? (
                        <p className="mt-1 text-sm text-text-muted">{mod.overview}</p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      {complete ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <IconCheckCircle className="h-4 w-4" /> Completed
                        </span>
                      ) : unlocked ? (
                        <span className="text-xs font-medium text-text-muted">
                          {doneLessons}/{totalLessons} lessons
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted">
                          <IconLock className="h-3.5 w-3.5" />
                          {released ? "Complete the previous week" : (
                            <span className="inline-flex items-center gap-1">
                              <IconClock className="h-3.5 w-3.5" /> Unlocks {formatDate(mod.releaseAt)}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {unlocked ? (
                    <ul className="mt-4 divide-y divide-border text-sm">
                      {mod.lessons.map((lesson) => {
                        const done = Boolean(lesson.progress[0]?.completedAt);
                        return (
                          <li key={lesson.id}>
                            <Link
                              href={`/student/courses/${courseId}/modules/${mod.id}/lessons/${lesson.id}`}
                              className="flex items-center justify-between rounded-md px-2 py-2.5 transition-colors hover:bg-surface-2"
                            >
                              <span className="flex items-center gap-2.5">
                                {done ? (
                                  <IconCheckCircle className="h-4.5 w-4.5 text-brand-1 dark:text-brand-3" />
                                ) : (
                                  <IconPlay className="h-4.5 w-4.5 text-text-muted" />
                                )}
                                <span className={done ? "text-text-muted" : ""}>{lesson.title}</span>
                              </span>
                              {lesson.durationMin ? (
                                <span className="text-xs text-text-muted">{lesson.durationMin} min</span>
                              ) : null}
                            </Link>
                          </li>
                        );
                      })}
                      {mod.assignments.map((a) => (
                        <li key={a.id}>
                          <Link
                            href={`/student/assignments/${a.id}`}
                            className="flex items-center justify-between rounded-md px-2 py-2.5 transition-colors hover:bg-surface-2"
                          >
                            <span className="flex items-center gap-2.5">
                              <IconAssignments className="h-4.5 w-4.5 text-text-muted" />
                              {a.title}
                            </span>
                            <span className="text-xs text-text-muted">Assignment · {a.maxScore} pts</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
