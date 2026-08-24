import Link from "next/link";
import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import { EmptyState } from "@/components/ui/empty";
import { CourseMark } from "@/components/course-mark";
import { CrestBackground } from "@/components/crest";
import {
  IconArrowRight,
  IconCheck,
  IconClock,
  IconLock,
  IconMedal,
  IconBell,
  IconAnnouncement,
} from "@/components/icons";
import { getCourseProgress } from "@/lib/progress";
import { buildMilestones } from "@/lib/milestones";
import { formatNaira, formatDate } from "@/lib/format";
import { subscriptionMonthlyTotal } from "@/lib/enrollment";

export const metadata = { title: "Dashboard" };

export default async function StudentDashboard() {
  const user = await requireStudent();

  // Single parallel batch — every query goes out at once over the shared connection.
  const [enrollments, notifications, announcements, subscription, application, lessonDone, submissions, grades] =
    await Promise.all([
      db.enrollment.findMany({
        where: { userId: user.id },
        include: { course: true },
        orderBy: { createdAt: "asc" },
      }),
      db.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.announcement.findMany({
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      db.subscription.findUnique({ where: { userId: user.id }, include: { items: true } }),
      db.application.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      db.lessonProgress.count({ where: { userId: user.id, completedAt: { not: null } } }),
      db.assignmentSubmission.count({ where: { userId: user.id } }),
      db.grade.count({ where: { submission: { userId: user.id } } }),
    ]);
  const milestones = buildMilestones(enrollments, lessonDone, submissions, grades);

  const accepted = enrollments.filter((e) => e.status === "ACCEPTED");
  const progress = await Promise.all(
    accepted.map((e) => getCourseProgress(user.id, e.courseId))
  );
  const progressByCourse = new Map(progress.map((p) => [p.courseId, p]));
  const overallPercent =
    progress.length === 0
      ? 0
      : Math.round(progress.reduce((sum, p) => sum + p.percent, 0) / progress.length);

  const firstName = user.fullName.split(" ")[0];
  const achievedCount = milestones.filter((m) => m.achieved).length;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Academy hero band */}
      <section className="hero-band rounded-2xl p-6 md:p-8" aria-label="Welcome">
        <CrestBackground className="pointer-events-none absolute -right-10 -top-6 h-44 w-auto opacity-10" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0">
            <p className="hero-eyebrow text-[11px] font-semibold uppercase tracking-[0.18em]">
              UCA Sandbox · Student Portal
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
              Welcome back, {firstName}
            </h1>
            <p className="hero-muted mt-1.5 max-w-md text-sm">
              {accepted.length > 0
                ? `You have ${accepted.length} active course${accepted.length === 1 ? "" : "s"} in your academy program. Keep the momentum going.`
                : "Your academy journey starts with your application."}
            </p>
          </div>
          {accepted.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-white/60">
                  Program progress
                </p>
                <p className="mt-0.5 text-sm text-white/80">
                  {achievedCount} of {milestones.length} milestones
                </p>
              </div>
              <ProgressRing value={overallPercent} size={72} stroke={6} />
            </div>
          ) : null}
        </div>
      </section>

      {enrollments.length === 0 ? (
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Begin</p>
            <h2 className="mt-1 text-lg font-semibold">Start your application</h2>
            <p className="mt-1 max-w-md text-sm text-text-muted">
              Complete your academy application to unlock Personal Branding and Social Media
              immediately, and choose the elective that defines your path.
            </p>
          </div>
          <ButtonLink href="/student/apply">Apply to the academy</ButtonLink>
        </Card>
      ) : (
        <section aria-label="Your Academy Program">
          <div className="flex items-end justify-between">
            <div>
              <p className="eyebrow">01 — Your Academy Program</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight">Three courses. One path.</h2>
            </div>
            <Link
              href="/student/progress"
              className="flex items-center gap-1 text-sm font-medium text-brand-1 hover:text-brand-2 dark:text-brand-3"
            >
              Full progress <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {enrollments.map((enrollment) => {
              const p = progressByCourse.get(enrollment.courseId);
              const accessible = enrollment.status === "ACCEPTED";
              return (
                <Card key={enrollment.id} className="flex flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <CourseMark slug={enrollment.course.slug} />
                    <Badge tone={statusTone(enrollment.status)}>
                      {enrollment.status.toLowerCase()}
                    </Badge>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold">{enrollment.course.name}</h3>
                  <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-text-muted">
                    {enrollment.enrollmentType === "COMPULSORY" ? "Compulsory" : "Elective"}
                  </p>
                  {accessible ? (
                    <>
                      <div className="mt-4 flex flex-1 items-end justify-between gap-3">
                        <div className="text-xs text-text-muted">
                          <p>
                            {p?.completedLessons ?? 0}/{p?.totalLessons ?? 0} lessons
                          </p>
                          <p>
                            {p?.submittedAssignments ?? 0}/{p?.totalAssignments ?? 0} assignments
                          </p>
                        </div>
                        <ProgressRing value={p?.percent ?? 0} size={52} stroke={5} />
                      </div>
                      <ButtonLink
                        href={`/student/courses/${enrollment.courseId}`}
                        className="mt-4 w-full"
                      >
                        Continue learning
                      </ButtonLink>
                    </>
                  ) : (
                    <div className="mt-4 flex flex-1 items-start gap-2.5 rounded-lg bg-surface-2 p-3">
                      {enrollment.status === "PENDING" ? (
                        <IconClock className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                      ) : (
                        <IconLock className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                      )}
                      <p className="text-sm text-text-muted">
                        {enrollment.status === "PENDING"
                          ? "Awaiting academy review. You'll be notified the moment it's approved."
                          : enrollment.status === "REJECTED"
                            ? "Not approved. You may apply for a different elective."
                            : "This enrollment is not currently active."}
                      </p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Milestones */}
      <section aria-label="Milestones">
        <p className="eyebrow">02 — Milestones</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight">Your journey so far</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {milestones.map((milestone) => (
            <div
              key={milestone.id}
              className={`rounded-xl border p-3.5 text-center transition-colors ${
                milestone.achieved
                  ? "border-brand-1/30 bg-brand-3/15"
                  : "border-dashed border-border bg-surface opacity-60"
              }`}
            >
              <span
                className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full ${
                  milestone.achieved
                    ? "bg-brand-1 text-white"
                    : "border border-dashed border-border text-text-muted"
                }`}
              >
                {milestone.achieved ? (
                  <IconCheck className="h-4.5 w-4.5" />
                ) : (
                  <IconMedal className="h-4.5 w-4.5" />
                )}
              </span>
              <p className="mt-2 text-xs font-semibold">{milestone.title}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-text-muted">
                {milestone.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {subscription ? (
        <section aria-label="Billing">
          <p className="eyebrow">03 — Membership</p>
          <Card className="mt-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Billing</h2>
                <p className="mt-1 text-sm text-text-muted">
                  {subscription.status === "TRIAL"
                    ? `Your free month runs until ${formatDate(subscription.trialEndsAt)}.`
                    : "Your subscription is active."}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={statusTone(subscription.status)}>{subscription.status.toLowerCase()}</Badge>
                <Link href="/student/billing" className="text-xs font-semibold text-brand-1 hover:underline dark:text-brand-3">
                  Manage billing
                </Link>
              </div>
            </div>
            <div className="mt-4 space-y-1 text-sm">
              {subscription.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span>
                    {enrollments.find((e) => e.courseId === item.courseId)?.course.name ?? "Course"}
                  </span>
                  <span>{formatNaira(item.price)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <span>After your first month</span>
                <span>{formatNaira(subscriptionMonthlyTotal(subscription.items))}/month</span>
              </div>
            </div>
          </Card>
        </section>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-label="Notifications">
          <div className="flex items-center gap-2">
            <IconBell className="h-4.5 w-4.5 text-brand-1 dark:text-brand-3" />
            <h2 className="text-lg font-semibold">Notifications</h2>
          </div>
          <div className="mt-3 space-y-2">
            {notifications.length === 0 ? (
              <EmptyState title="You're all up to date." />
            ) : (
              notifications.map((n) => (
                <Card key={n.id} className="p-4">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body ? <p className="mt-0.5 text-sm text-text-muted">{n.body}</p> : null}
                </Card>
              ))
            )}
          </div>
        </section>
        <section aria-label="Announcements">
          <div className="flex items-center gap-2">
            <IconAnnouncement className="h-4.5 w-4.5 text-brand-1 dark:text-brand-3" />
            <h2 className="text-lg font-semibold">Academy bulletin</h2>
          </div>
          <div className="mt-3 space-y-2">
            {announcements.length === 0 ? (
              <EmptyState
                title="No announcements yet."
                body="Academy announcements will appear here."
              />
            ) : (
              announcements.map((a) => (
                <Card key={a.id} className="p-4">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="mt-0.5 text-sm text-text-muted">{a.body}</p>
                </Card>
              ))
            )}
          </div>
        </section>
      </div>

      {application?.status === "REJECTED" ? (
        <Card>
          <p className="text-sm">
            Your elective was not approved.{" "}
            <Link
              href="/student/apply"
              className="font-medium text-brand-1 hover:text-brand-2 dark:text-brand-3"
            >
              Apply for a different elective
            </Link>
            .
          </p>
        </Card>
      ) : null}
    </div>
  );
}
