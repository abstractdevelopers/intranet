import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { LessonView } from "@/components/lessons/lesson-view";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ courseId: string; moduleId: string; lessonId: string }>;
}) {
  const { courseId, moduleId, lessonId } = await params;
  const user = await requireStudent();

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    select: { status: true, course: { select: { name: true } } },
  });
  if (!enrollment) notFound();
  if (enrollment.status !== "ACCEPTED") redirect("/student/courses");

  const lesson = await db.lesson.findFirst({
    where: { id: lessonId, moduleId, module: { courseId, status: "PUBLISHED" } },
    include: {
      module: { select: { id: true, title: true, weekNumber: true, releaseAt: true, order: true } },
      resources: { orderBy: { title: "asc" } },
      progress: { where: { userId: user.id } },
    },
  });
  if (!lesson) notFound();

  if (lesson.module.releaseAt && lesson.module.releaseAt > new Date()) {
    redirect(`/student/courses/${courseId}`);
  }

  // Next lesson in the week, for the "Complete & continue" flow.
  const next = await db.lesson.findFirst({
    where: { moduleId, order: { gt: lesson.order } },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav className="text-xs text-text-muted">
        <Link href={`/student/courses/${courseId}`} className="hover:text-brand-1">
          {enrollment.course.name}
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/student/courses/${courseId}/modules/${moduleId}`}
          className="hover:text-brand-1"
        >
          Week {lesson.module.weekNumber} · {lesson.module.title}
        </Link>
      </nav>

      <header>
        <p className="eyebrow">Lesson</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{lesson.title}</h1>
        {lesson.durationMin ? (
          <p className="mt-1 text-sm text-text-muted">{lesson.durationMin} min</p>
        ) : null}
      </header>

      <LessonView
        lessonId={lesson.id}
        content={lesson.content}
        youtubeVideoId={lesson.youtubeVideoId}
        resources={lesson.resources.map((r) => ({
          id: r.id,
          title: r.title,
          type: r.type,
          url: r.url,
          documentId: r.documentId,
        }))}
        initialCompleted={Boolean(lesson.progress[0]?.completedAt)}
        nextLessonHref={
          next ? `/student/courses/${courseId}/modules/${moduleId}/lessons/${next.id}` : null
        }
      />
    </div>
  );
}
