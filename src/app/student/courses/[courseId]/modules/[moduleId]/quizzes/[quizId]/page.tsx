import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { QuizRunner } from "@/components/lessons/quiz-runner";
import { getModuleQuiz } from "@/lib/quiz";
import { canAccessModule, isQuizReleased } from "@/lib/module-access";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ courseId: string; moduleId: string; quizId: string }>;
}) {
  const { courseId, moduleId, quizId } = await params;
  const user = await requireStudent();

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    select: { status: true, course: { select: { name: true } } },
  });
  if (!enrollment) notFound();
  if (enrollment.status !== "ACCEPTED") redirect("/student/courses");

  const quiz = await db.quiz.findFirst({
    where: {
      id: quizId,
      moduleId,
      status: "PUBLISHED",
      module: { courseId, status: "PUBLISHED" },
    },
    include: {
      module: { select: { id: true, title: true, weekNumber: true, releaseAt: true } },
    },
  });
  if (!quiz) notFound();
  // The query above filters on `module: { courseId }`, so the relation is
  // always present here; the schema just types it nullable because Intranet 101
  // has no module.
  const quizModule = quiz.module!;

  // Same gate as lessons and assignments: the week must be unlocked and the quiz
  // released, so a deep link cannot jump ahead of the timeline.
  const access = await canAccessModule(user.id, courseId, moduleId);
  if (!access.allowed) {
    if (access.reason === "LOCKED_LOG") redirect("/student/captains-log");
    redirect(`/student/courses/${courseId}`);
  }

  const released = isQuizReleased({
    quizReleaseAt: quiz.releaseAt,
    moduleReleaseAt: quizModule.releaseAt,
    preview: user.previewUnreleasedContent,
  });
  if (!released) redirect(`/student/courses/${courseId}/modules/${moduleId}`);

  const view = await getModuleQuiz(quiz.id, user.id);
  if (!view) notFound();

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
          Week {quizModule.weekNumber} · {quizModule.title}
        </Link>
      </nav>

      <QuizRunner
        eyebrow={`Week ${quizModule.weekNumber} quiz`}
        title={view.title}
        description={view.description}
        passMark={view.passMark}
        maxAttempts={view.maxAttempts}
        attemptsUsed={view.attemptsUsed}
        attemptsLeft={view.attemptsLeft}
        passed={view.passed}
        questions={view.questions}
        initialScore={view.lastAttempt?.score ?? null}
        submitUrl={`/api/student/quizzes/${quiz.id}`}
        passedNote="You've passed this week's quiz. You can revisit it any time."
        outOfAttemptsNote="You've used both attempts. Reach out to the academy team and they'll help you get this sorted."
        retryNote="Have another look at the week's lessons, then take your final attempt."
        backHref={`/student/courses/${courseId}/modules/${moduleId}`}
        backLabel="Back to the week"
      />
    </div>
  );
}
