import Link from "next/link";
import { requireStudent } from "@/lib/rbac";
import { getReleasedModules, getScoreBreakdown, ASSIGNMENT_WEIGHT, QUIZ_WEIGHT } from "@/lib/scores";
import { getCourseStandings } from "@/lib/leaderboard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressRing } from "@/components/ui/progress-ring";
import { EmptyState } from "@/components/ui/empty";
import { CourseMark } from "@/components/course-mark";

export const metadata = { title: "Scores" };

function tone(percent: number) {
  if (percent >= 70) return "success" as const;
  if (percent >= 50) return "warning" as const;
  return "danger" as const;
}

export default async function ScoresPage() {
  const user = await requireStudent();

  const [modules, standings] = await Promise.all([
    getReleasedModules(user.id),
    getCourseStandings(user.id),
  ]);
  const breakdown = await getScoreBreakdown(user.id, modules);
  const weeks = [...new Set(modules.map((m) => m.weekNumber))].sort((a, b) => a - b);
  const courses = [...new Set(modules.map((m) => m.courseSlug))].sort();
  const scored = modules.filter((m) => m.hasAssignments || m.hasQuizzes);

  if (scored.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <p className="eyebrow">Scores</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Your Scores</h1>
        <div className="mt-6">
          <EmptyState
            title="No scores yet."
            body="Your scores appear here once your first week is released and your work has been graded."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="eyebrow">Scores</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Your Scores</h1>
        <p className="mt-1.5 text-sm text-text-muted">
          {`Each week is ${Math.round(ASSIGNMENT_WEIGHT * 100)}% assignments and ${Math.round(
            QUIZ_WEIGHT * 100,
          )}% quizzes. Your overall score is the average of your weeks.`}
        </p>
      </header>

      <section aria-label="Overall">
        <p className="eyebrow">01 — Overall</p>
        <Card className="mt-4 flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-sm text-text-muted">Overall score</p>
            <p className="mt-1 text-4xl font-bold tracking-tight">{breakdown.overall.percent}%</p>
            <p className="mt-1 text-sm text-text-muted">
              {breakdown.overall.earned} of {breakdown.overall.possible} assignment points, averaged
              across {breakdown.weekly.length} week{breakdown.weekly.length === 1 ? "" : "s"} of work
            </p>
          </div>
          <ProgressRing value={breakdown.overall.percent} size={104} stroke={8} />
        </Card>
      </section>

      <section aria-label="By week">
        <p className="eyebrow">02 — Week by week</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {breakdown.weekly.map((w) => {
            const rows = modules.filter(
              (m) => m.weekNumber === w.weekNumber && (m.hasAssignments || m.hasQuizzes),
            );
            return (
              <Card key={w.weekNumber} className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{w.label}</p>
                  <Badge tone={tone(w.percent)}>{w.percent}%</Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {rows.map((m) => (
                    <div key={m.moduleId} className="text-xs text-text-muted">
                      <div className="flex items-center gap-2">
                        <CourseMark slug={m.courseSlug} size="sm" />
                        <span className="flex-1 truncate">{m.courseName}</span>
                        <span className="font-semibold text-text">{m.percent}%</span>
                      </div>
                      <p className="mt-0.5 pl-11">
                        {m.hasAssignments
                          ? `Assignment ${m.assignmentEarned}/${m.assignmentPossible}`
                          : "No assignment"}
                        {" · "}
                        {m.hasQuizzes ? `Quiz ${m.quizPercent}%` : "No quiz"}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-label="Standings">
        <p className="eyebrow">03 — Where you stand</p>
        <p className="mt-1 text-sm text-text-muted">
          Ranked within your course, among students with at least one graded piece of work.
        </p>
        <div className="mt-4 space-y-4">
          {standings.length === 0 ? (
            <Card>
              <p className="text-sm text-text-muted">You aren&rsquo;t enrolled in a course yet.</p>
            </Card>
          ) : (
            standings.map((s) => (
              <Card key={s.courseId} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CourseMark slug={s.courseSlug} size="sm" />
                    <div>
                      <p className="text-sm font-semibold">{s.courseName}</p>
                      <p className="text-xs text-text-muted">
                        {s.rank
                          ? `#${s.rank} of ${s.rankedStudents} ranked`
                          : "Not ranked yet — submit some work to appear here"}
                      </p>
                    </div>
                  </div>
                  <Badge tone={tone(s.myPercent)}>{s.myPercent}%</Badge>
                </div>

                {s.around.length > 0 ? (
                  <ol className="mt-4 space-y-1">
                    {s.around.map((r) => (
                      <li
                        key={r.userId}
                        className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${
                          r.isMe ? "bg-brand-3/20 font-semibold" : "text-text-muted"
                        }`}
                      >
                        <span className="truncate">{r.isMe ? "You" : r.name}</span>
                        <span className="tabular-nums">{r.percent}%</span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </Card>
            ))
          )}
        </div>
      </section>

      <section aria-label="All weeks">
        <p className="eyebrow">04 — All weeks</p>
        <Card className="mt-4 overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="px-4 py-3 font-semibold">Course</th>
                {weeks.map((w) => (
                  <th key={w} className="px-4 py-3 text-right font-semibold">
                    W{w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {courses.map((slug) => {
                const courseModules = modules.filter((m) => m.courseSlug === slug);
                return (
                  <tr key={slug} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{courseModules[0].courseName}</td>
                    {weeks.map((w) => {
                      const m = courseModules.find((x) => x.weekNumber === w);
                      if (!m || (!m.hasAssignments && !m.hasQuizzes)) {
                        return (
                          <td key={w} className="px-4 py-3 text-right text-text-muted">
                            —
                          </td>
                        );
                      }
                      return (
                        <td key={w} className="px-4 py-3 text-right tabular-nums">
                          {m.percent}%
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <p className="mt-2 text-xs text-text-muted">
          A dash means no work was released for that course that week. See{" "}
          <Link href="/student/progress" className="text-brand-1 hover:underline dark:text-brand-3">
            Progress
          </Link>{" "}
          for the full academic record.
        </p>
      </section>
    </div>
  );
}
