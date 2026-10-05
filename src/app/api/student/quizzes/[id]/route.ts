import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOnboardedStudentApi } from "@/lib/rbac";
import { getModuleQuiz, submitModuleQuiz } from "@/lib/quiz";
import { db } from "@/lib/db";
import { canAccessModule, isQuizReleased } from "@/lib/module-access";

/**
 * A week quiz.
 *
 * Access is re-checked here rather than trusted from the page: the student must
 * be enrolled on the quiz's course, the week must be unlocked, and the quiz must
 * have been released. GET strips the correct answers; POST grades on the server
 * and enforces the attempt limit.
 */
async function loadQuiz(quizId: string, userId: string) {
  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      status: true,
      releaseAt: true,
      moduleId: true,
      module: { select: { id: true, courseId: true, releaseAt: true } },
    },
  });
  if (!quiz || quiz.status !== "PUBLISHED" || !quiz.module || !quiz.moduleId) return null;

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: quiz.module.courseId } },
    select: { status: true },
  });
  if (!enrollment || enrollment.status !== "ACCEPTED") return null;

  const access = await canAccessModule(userId, quiz.module.courseId, quiz.moduleId);
  if (!access.allowed) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { previewUnreleasedContent: true },
  });
  const released = isQuizReleased({
    quizReleaseAt: quiz.releaseAt,
    moduleReleaseAt: quiz.module.releaseAt,
    preview: user?.previewUnreleasedContent ?? false,
  });
  if (!released) return null;

  return quiz;
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const quiz = await loadQuiz(id, guard.user.id);
  if (!quiz) return NextResponse.json({ error: "Quiz not available." }, { status: 404 });

  const view = await getModuleQuiz(quiz.id, guard.user.id);
  if (!view) return NextResponse.json({ error: "Quiz not available." }, { status: 404 });
  return NextResponse.json(view);
}

const schema = z.object({
  answers: z.record(z.string(), z.string()),
});

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const quiz = await loadQuiz(id, guard.user.id);
  if (!quiz) return NextResponse.json({ error: "Quiz not available." }, { status: 404 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid submission." }, { status: 400 });

  const result = await submitModuleQuiz(quiz.id, guard.user.id, parsed.data.answers);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
