import Link from "next/link";
import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Quizzes" };

/**
 * Every quiz attempt across the academy.
 *
 * Read-only for now. The grading system for quizzes and assignments is still
 * being decided, so this records and displays results without judging them:
 * attempts are kept, and failing one does not hold a student back — nothing in
 * the portal gates on a week quiz result.
 */
export default async function AdminQuizzesPage() {
  await requireStaff();

  const quizzes = await db.quiz.findMany({
    include: {
      module: { include: { course: { select: { id: true, name: true } } } },
      _count: { select: { questions: true, attempts: true } },
    },
    orderBy: [{ module: { course: { name: "asc" } } }, { releaseAt: "asc" }, { slug: "asc" }],
    take: 200,
  });

  // Recent attempts, newest first. Bounded so the page stays quick as the
  // academy grows; a per-quiz drill-down can come later if it is needed.
  const attempts = await db.quizAttempt.findMany({
    include: {
      user: { select: { email: true, profile: { select: { fullName: true } } } },
      quiz: { select: { slug: true, title: true, passMark: true } },
    },
    orderBy: { submittedAt: "desc" },
    take: 60,
  });

  const totalAttempts = quizzes.reduce((n, q) => n + q._count.attempts, 0);
  const passedAttempts = await db.quizAttempt.count({ where: { passed: true } });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="eyebrow">Teach</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Quizzes</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Every quiz and every attempt, recorded. Nothing here blocks a student: a failed
          attempt is kept, and they can carry on with the week regardless.
        </p>
      </header>

      <div className="flex flex-wrap gap-4 text-sm">
        <span className="text-text-muted">
          <span className="font-semibold text-text">{quizzes.length}</span> quizzes
        </span>
        <span className="text-text-muted">
          <span className="font-semibold text-text">{totalAttempts}</span> attempts
        </span>
        <span className="text-text-muted">
          <span className="font-semibold text-text">{passedAttempts}</span> passed
        </span>
      </div>

      <section>
        <p className="eyebrow">All quizzes</p>
        {quizzes.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No quizzes yet" body="Week quizzes appear here once seeded." />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {quizzes.map((q) => (
              <li key={q.id}>
                <Card className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{q.title}</p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {q.module
                        ? `${q.module.course.name} · Week ${q.module.weekNumber}`
                        : "Academy-wide"}
                      {" · "}
                      {q._count.questions} questions · {q.passMark}% to pass ·{" "}
                      {q.maxAttempts} attempts
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {q.releaseAt ? (
                      <span className="text-xs text-text-muted">
                        Opens {formatDate(q.releaseAt)}
                      </span>
                    ) : null}
                    <Badge tone={q.status === "PUBLISHED" ? "success" : "warning"}>
                      {q.status}
                    </Badge>
                    <span className="text-xs font-medium text-text-muted">
                      {q._count.attempts} attempt{q._count.attempts === 1 ? "" : "s"}
                    </span>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="eyebrow">Recent attempts</p>
        {attempts.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No attempts yet"
              body="Student attempts appear here as they come in."
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-text-muted">
                  <th className="py-2 pr-4 font-semibold">Student</th>
                  <th className="py-2 pr-4 font-semibold">Quiz</th>
                  <th className="py-2 pr-4 font-semibold">Score</th>
                  <th className="py-2 pr-4 font-semibold">Result</th>
                  <th className="py-2 font-semibold">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-4">
                      <span className="block font-medium">
                        {a.user.profile?.fullName ?? a.user.email}
                      </span>
                      <span className="text-xs text-text-muted">{a.user.email}</span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="block">{a.quiz.title}</span>
                      <span className="text-xs text-text-muted">{a.quiz.slug}</span>
                    </td>
                    <td className="py-2.5 pr-4 font-semibold">{a.score}%</td>
                    <td className="py-2.5 pr-4">
                      <Badge tone={a.passed ? "success" : "warning"}>
                        {a.passed ? "Passed" : "Failed"}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-xs text-text-muted">
                      {formatDate(a.submittedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-text-muted">
              Showing the {attempts.length} most recent of {totalAttempts}.
            </p>
          </div>
        )}
      </section>

      <p className="text-sm text-text-muted">
        <Link href="/admin/assignments" className="font-semibold text-brand-1 hover:underline">
          Assignments
        </Link>{" "}
        shows submission counts; grades are visible on each assignment.
      </p>
    </div>
  );
}
