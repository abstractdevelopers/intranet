import Link from "next/link";
import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty";
import { getCourseProgress } from "@/lib/progress";
import { formatNaira, formatDate } from "@/lib/format";
import { subscriptionMonthlyTotal } from "@/lib/enrollment";

export const metadata = { title: "Dashboard" };

export default async function StudentDashboard() {
  const user = await requireStudent();

  const [enrollments, notifications, announcements, subscription, application] = await Promise.all([
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
      where: { audience: "ACADEMY" },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    db.subscription.findUnique({ where: { userId: user.id }, include: { items: true } }),
    db.application.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);

  const accepted = enrollments.filter((e) => e.status === "ACCEPTED");
  const progress = await Promise.all(accepted.map((e) => getCourseProgress(user.id, e.courseId)));
  const progressByCourse = new Map(progress.map((p) => [p.courseId, p]));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back, {user.fullName.split(" ")[0]} 👋</h1>
        <p className="mt-1 text-sm text-text-muted">Here is your academy program at a glance.</p>
      </div>

      {enrollments.length === 0 ? (
        <Card>
          <h2 className="text-base font-semibold">Start your application</h2>
          <p className="mt-1 text-sm text-text-muted">
            Complete your academy application to unlock Personal Branding and Social Media
            immediately, and choose your elective.
          </p>
          <ButtonLink href="/student/apply" className="mt-4">Apply to the academy</ButtonLink>
        </Card>
      ) : (
        <section aria-label="Your Academy Program">
          <h2 className="text-lg font-semibold">Your Academy Program</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {enrollments.map((enrollment) => {
              const p = progressByCourse.get(enrollment.courseId);
              const accessible = enrollment.status === "ACCEPTED";
              return (
                <Card key={enrollment.id} className="flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{enrollment.course.name}</h3>
                    <Badge tone={statusTone(enrollment.status)}>{enrollment.status.toLowerCase()}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {enrollment.enrollmentType === "COMPULSORY" ? "Compulsory" : "Elective"}
                  </p>
                  {accessible ? (
                    <>
                      <div className="mt-4 flex-1">
                        <ProgressBar value={p?.percent ?? 0} label="Progress" />
                      </div>
                      <ButtonLink href={`/student/courses/${enrollment.courseId}`} className="mt-4 w-full">
                        Continue learning
                      </ButtonLink>
                    </>
                  ) : (
                    <p className="mt-4 flex-1 text-sm text-text-muted">
                      {enrollment.status === "PENDING"
                        ? "Awaiting academy review. You'll be notified once it's approved."
                        : enrollment.status === "REJECTED"
                          ? "This elective was not approved. You may apply for a different elective."
                          : "This enrollment is not currently active."}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {subscription ? (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Billing</h2>
              <p className="mt-1 text-sm text-text-muted">
                {subscription.status === "TRIAL"
                  ? `Your free month runs until ${formatDate(subscription.trialEndsAt)}.`
                  : "Your subscription is active."}
              </p>
            </div>
            <Badge tone={statusTone(subscription.status)}>{subscription.status.toLowerCase()}</Badge>
          </div>
          <div className="mt-4 space-y-1 text-sm">
            {subscription.items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>{enrollments.find((e) => e.courseId === item.courseId)?.course.name ?? "Course"}</span>
                <span>{formatNaira(item.price)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-border pt-2 font-semibold">
              <span>After your first month</span>
              <span>{formatNaira(subscriptionMonthlyTotal(subscription.items))}/month</span>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-label="Notifications">
          <h2 className="text-lg font-semibold">Notifications</h2>
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
          <h2 className="text-lg font-semibold">Announcements</h2>
          <div className="mt-3 space-y-2">
            {announcements.length === 0 ? (
              <EmptyState title="No announcements yet." body="Academy announcements will appear here." />
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
            <Link href="/student/apply" className="font-medium text-brand-1 hover:text-brand-2 dark:text-brand-3">
              Apply for a different elective
            </Link>
            .
          </p>
        </Card>
      ) : null}
    </div>
  );
}
