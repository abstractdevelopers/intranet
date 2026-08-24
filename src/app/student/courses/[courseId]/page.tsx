import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty";
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
    moduleStates.push({ mod, released, complete, unlocked });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-sm text-text-muted">{enrollment.course.type === "COMPULSORY" ? "Compulsory course" : "Elective course"}</p>
        <h1 className="text-2xl font-bold tracking-tight">{enrollment.course.name}</h1>
        <p className="mt-1 text-sm text-text-muted">{enrollment.course.description}</p>
        <div className="mt-4 max-w-sm">
          <ProgressBar value={progress.percent} label="Course progress" />
        </div>
      </div>

      {moduleStates.length === 0 ? (
        <EmptyState title="Content is on the way" body="Modules for this course will appear here once published." />
      ) : (
        <div className="space-y-4">
          {moduleStates.map(({ mod, released, complete, unlocked }) => (
            <Card key={mod.id} className={unlocked ? "" : "opacity-70"}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Week {mod.weekNumber}</p>
                  <h2 className="mt-0.5 text-base font-semibold">{mod.title}</h2>
                  {mod.overview ? <p className="mt-1 text-sm text-text-muted">{mod.overview}</p> : null}
                </div>
                {complete ? (
                  <Badge tone="success">completed</Badge>
                ) : unlocked ? (
                  <Badge tone="brand">available</Badge>
                ) : (
                  <Badge tone="neutral">
                    🔒 {released ? "complete previous week" : `unlocks ${formatDate(mod.releaseAt)}`}
                  </Badge>
                )}
              </div>
              {unlocked ? (
                <ul className="mt-4 divide-y divide-border text-sm">
                  {mod.lessons.map((lesson) => {
                    const done = Boolean(lesson.progress[0]?.completedAt);
                    return (
                      <li key={lesson.id} className="flex items-center justify-between py-2">
                        <span className="flex items-center gap-2">
                          <span aria-hidden>{done ? "✅" : "▶️"}</span>
                          {lesson.title}
                        </span>
                        {lesson.durationMin ? <span className="text-xs text-text-muted">{lesson.durationMin} min</span> : null}
                      </li>
                    );
                  })}
                  {mod.assignments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-2">
                      <span className="flex items-center gap-2"><span aria-hidden>📝</span>{a.title}</span>
                      <span className="text-xs text-text-muted">Assignment · {a.maxScore} pts</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
