import Link from "next/link";
import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { ButtonLink } from "@/components/ui/button";
import { CourseMark } from "@/components/course-mark";
import { ProgressRing } from "@/components/ui/progress-ring";
import { IconMedal, IconCheck, IconAnnouncement } from "@/components/icons";
import { CaptainLogAnswers } from "@/components/captains-log/captain-log-answers";
import { getCourseProgress } from "@/lib/progress";
import { getMilestones } from "@/lib/milestones";
import { getScoreBreakdown } from "@/lib/scores";
import { formatDate, formatNaira } from "@/lib/format";
import { subscriptionMonthlyTotal } from "@/lib/enrollment";

export const metadata = { title: "Progress" };

export default async function ProgressPage() {
  const user = await requireStudent();
  const enrollments = await db.enrollment.findMany({
    where: { userId: user.id, status: "ACCEPTED" },
    include: { course: true },
    orderBy: { createdAt: "asc" },
  });

  const [progress, milestones, scores, captainLogs, submissions, grades, certificates, subscription] =
    await Promise.all([
      Promise.all(enrollments.map((e) => getCourseProgress(user.id, e.courseId))),
      getMilestones(user.id),
      getScoreBreakdown(user.id),
      db.captainLog.findMany({
        where: { userId: user.id },
        orderBy: { weekNumber: "desc" },
        take: 12,
      }),
      db.assignmentSubmission.findMany({
        where: { userId: user.id },
        include: {
          assignment: {
            select: {
              title: true,
              maxScore: true,
              module: { select: { weekNumber: true, course: { select: { name: true } } } },
            },
          },
          grade: true,
        },
        orderBy: { submittedAt: "desc" },
        take: 30,
      }),
      db.grade.findMany({
        where: { submission: { userId: user.id } },
        include: { submission: { select: { assignment: { select: { title: true } } } } },
        orderBy: { gradedAt: "desc" },
        take: 10,
      }),
      db.certificate.findMany({
        where: { userId: user.id },
        include: { course: { select: { name: true, slug: true } } },
      }),
      db.subscription.findUnique({ where: { userId: user.id }, include: { items: true } }),
    ]);

  const releasedWeeks = scores.overall.releasedModules;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="eyebrow">Progress</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Your Progress</h1>
        <p className="mt-1 text-sm text-text-muted">
          The complete academic record — scores, weekly performance, Captain&rsquo;s Logs and
          milestones.
        </p>
      </div>

      {enrollments.length === 0 ? (
        <EmptyState
          title="No active courses yet"
          body="Once your courses are active, your progress will be tracked here."
          action={<ButtonLink href="/student/apply">View application</ButtonLink>}
        />
      ) : (
        <>
          {/* Overall + weekly + monthly scores */}
          <section aria-label="Scores">
            <p className="eyebrow">01 — Score tracker</p>
            <Card className="mt-4 flex flex-wrap items-center justify-between gap-6 p-6">
              <div>
                <p className="text-sm text-text-muted">Overall score</p>
                <p className="mt-1 text-3xl font-bold tracking-tight">
                  {scores.overall.percent}%
                </p>
                <p className="mt-1 text-sm text-text-muted">
                  {scores.overall.earned} of {scores.overall.possible} points across{" "}
                  {releasedWeeks} released week{releasedWeeks === 1 ? "" : "s"}
                </p>
              </div>
              <ProgressRing value={scores.overall.percent} size={88} stroke={7} />
            </Card>
            <p className="mt-2 text-xs text-text-muted">
              Calculated over every week released to you — including weeks you haven&rsquo;t
              submitted, which count as zero. This is what stops a high score being held by
              simply skipping available work.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <BreakdownTable
                title="Weekly performance"
                rows={scores.weekly.map((w) => ({
                  key: `${w.weekNumber}`,
                  label: w.label,
                  percent: w.percent,
                  earned: w.earned,
                  possible: w.possible,
                  detail: `${w.releasedModules} week${w.releasedModules === 1 ? "" : "s"} · ${w.gradedModules} graded`,
                }))}
                empty="Weekly scores appear once your first week is released."
              />
              <BreakdownTable
                title="Monthly performance"
                rows={scores.monthly.map((m) => ({
                  key: m.monthKey,
                  label: m.label,
                  percent: m.percent,
                  earned: m.earned,
                  possible: m.possible,
                  detail: `${m.releasedModules} week${m.releasedModules === 1 ? "" : "s"} · ${m.gradedModules} graded`,
                }))}
                empty="Monthly scores appear once your first month begins."
              />
            </div>
          </section>

          {/* Per-course progress */}
          <section aria-label="Courses">
            <p className="eyebrow">02 — Courses</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">Completion by course</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {progress.map((p) => {
                const course = enrollments.find((e) => e.courseId === p.courseId)?.course;
                return (
                  <Card key={p.courseId} className="p-5">
                    <div className="flex items-center justify-between">
                      <CourseMark slug={course?.slug ?? ""} />
                      <ProgressRing value={p.percent} size={52} stroke={5} />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold">{course?.name}</h3>
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
          </section>

          {/* Grades */}
          <section aria-label="Grades">
            <p className="eyebrow">03 — Grades</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">Graded work</h2>
            <div className="mt-4 space-y-2">
              {grades.length === 0 ? (
                <EmptyState
                  title="No grades yet"
                  body="Assignments are reviewed and graded at the end of the week."
                />
              ) : (
                grades.map((g) => (
                  <Card key={g.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="text-sm font-semibold">{g.submission.assignment.title}</p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        Graded {formatDate(g.gradedAt)}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-brand-1 dark:text-brand-3">
                      {g.score} / {g.maxScore}
                    </p>
                  </Card>
                ))
              )}
            </div>
          </section>

          {/* Captain's Logs */}
          <section aria-label="Captain's Logs">
            <div className="flex items-end justify-between">
              <div>
                <p className="eyebrow">04 — Captain&rsquo;s Logs</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight">Weekly reflections</h2>
              </div>
              <Link
                href="/student/captains-log"
                className="text-sm font-medium text-brand-1 hover:text-brand-2 dark:text-brand-3"
              >
                Open this week&rsquo;s log
              </Link>
            </div>
            <div className="mt-4 space-y-2">
              {captainLogs.length === 0 ? (
                <EmptyState
                  title="No logs submitted yet"
                  body="Your Captain's Log is due at the end of each week."
                  action={<ButtonLink href="/student/captains-log">Write your first log</ButtonLink>}
                />
              ) : (
                captainLogs.map((log) => (
                  <Card key={log.id} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <IconAnnouncement className="h-4.5 w-4.5 text-brand-1 dark:text-brand-3" />
                        <span className="text-sm font-semibold">Week {log.weekNumber}</span>
                        <Badge tone={log.status === "REVIEWED" ? "success" : "neutral"}>
                          {log.status.toLowerCase()}
                        </Badge>
                      </div>
                      <span className="text-xs text-text-muted">{formatDate(log.submittedAt)}</span>
                    </div>
                    <CaptainLogAnswers responses={log.responses} />
                  </Card>
                ))
              )}
            </div>
          </section>

          {/* Submission history — the permanent record */}
          <section aria-label="Submission history">
            <p className="eyebrow">05 — Submission history</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">Every submission on record</h2>
            <div className="mt-4 overflow-x-auto">
              {submissions.length === 0 ? (
                <EmptyState title="No submissions yet" />
              ) : (
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
                      <th className="py-2 pr-4 font-medium">Assignment</th>
                      <th className="py-2 pr-4 font-medium">Course · Week</th>
                      <th className="py-2 pr-4 font-medium">Submitted</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((s) => (
                      <tr key={s.id} className="border-b border-border">
                        <td className="py-2.5 pr-4">{s.assignment.title}</td>
                        <td className="py-2.5 pr-4 text-text-muted">
                          {s.assignment.module.course.name} · W{s.assignment.module.weekNumber}
                        </td>
                        <td className="py-2.5 pr-4 text-text-muted">
                          {formatDate(s.submittedAt)}
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge tone={statusTone(s.status)}>
                            {s.status.replaceAll("_", " ").toLowerCase()}
                          </Badge>
                        </td>
                        <td className="py-2.5 font-semibold">
                          {s.grade ? `${s.grade.score} / ${s.grade.maxScore}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* Milestones */}
          <section aria-label="Milestones">
            <p className="eyebrow">06 — Milestones</p>
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
                    {m.achieved ? (
                      <IconCheck className="h-4.5 w-4.5" />
                    ) : (
                      <IconMedal className="h-4.5 w-4.5" />
                    )}
                  </span>
                  <p className="mt-2 text-xs font-semibold">{m.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-text-muted">
                    {m.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Certificates + record summary */}
          <section aria-label="Certificates">
            <p className="eyebrow">07 — Certificates</p>
            <div className="mt-4 space-y-3">
              {certificates.length === 0 ? (
                <p className="text-sm text-text-muted">
                  Certificates are issued automatically when you complete every lesson and pass
                  every assignment in a course.{" "}
                  <Link
                    href="/student/certificates"
                    className="underline-offset-2 hover:underline"
                  >
                    View certificate page
                  </Link>
                </p>
              ) : (
                certificates.map((c) => (
                  <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <CourseMark slug={c.course.slug} size="sm" />
                      <div>
                        <p className="text-sm font-semibold">{c.course.name}</p>
                        <p className="text-xs text-text-muted">ID {c.certificateId}</p>
                      </div>
                    </div>
                    <span className="text-xs text-text-muted">Issued {formatDate(c.issuedAt)}</span>
                  </Card>
                ))
              )}
            </div>
          </section>

          {subscription ? (
            <section aria-label="Subscription record">
              <p className="eyebrow">08 — Subscription</p>
              <Card className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Badge tone={statusTone(subscription.status)}>
                    {subscription.status.toLowerCase()}
                  </Badge>
                  <span className="text-sm text-text-muted">
                    {formatNaira(subscriptionMonthlyTotal(subscription.items))}/month after your
                    free month
                  </span>
                </div>
              </Card>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function BreakdownTable({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: {
    key: string;
    label: string;
    percent: number;
    earned: number;
    possible: number;
    detail: string;
  }[];
  empty: string;
}) {
  return (
    <Card>
      <h3 className="text-base font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((r) => (
            <li key={r.key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{r.label}</span>
                <span className="text-sm font-bold">{r.percent}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-brand-1 dark:bg-brand-3"
                  style={{ width: `${r.percent}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-text-muted">
                {r.earned} / {r.possible} points · {r.detail}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
