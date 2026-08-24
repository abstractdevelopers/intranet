import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { CourseMark } from "@/components/course-mark";
import { formatNaira } from "@/lib/format";

export const metadata = { title: "Analytics" };

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-text-muted">{hint}</p> : null}
    </Card>
  );
}

export default async function AdminAnalyticsPage() {
  await requireStaff();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    totalStudents,
    newStudents,
    activeStudents,
    pendingApplications,
    enrollments,
    completedEnrollments,
    submissionCount,
    gradedSubmissions,
    gradeAgg,
    trials,
    activeSubs,
    courses,
  ] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "STUDENT", createdAt: { gte: monthStart } } }),
    db.user.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
    db.application.count({ where: { status: "PENDING" } }),
    db.enrollment.count({ where: { status: "ACCEPTED" } }),
    db.enrollment.count({ where: { status: "COMPLETED" } }),
    db.assignmentSubmission.count(),
    db.assignmentSubmission.count({ where: { status: "GRADED" } }),
    db.grade.aggregate({ _avg: { score: true }, _count: true }),
    db.subscription.count({ where: { status: "TRIAL" } }),
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.course.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { enrollments: { where: { status: "ACCEPTED" } } } },
      },
    }),
  ]);

  const completionRate = enrollments > 0 ? Math.round((completedEnrollments / enrollments) * 100) : 0;
  const gradingRate = submissionCount > 0 ? Math.round((gradedSubmissions / submissionCount) * 100) : 0;
  const trialConversion = trials + activeSubs > 0 ? Math.round((activeSubs / (trials + activeSubs)) * 100) : 0;
  const mrr = activeSubs > 0
    ? await db.subscriptionItem.aggregate({
        _sum: { price: true },
        where: { subscription: { status: "ACTIVE" } },
      })
    : null;
  const maxEnrollment = Math.max(1, ...courses.map((c) => c._count.enrollments));

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-text-muted">The academy&rsquo;s operating picture, from live data.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total students" value={totalStudents} hint={`${newStudents} new this month`} />
        <Stat label="Active students" value={activeStudents} />
        <Stat label="Pending applications" value={pendingApplications} />
        <Stat label="Completion rate" value={`${completionRate}%`} hint={`${completedEnrollments} of ${enrollments} enrollments completed`} />
        <Stat label="Submissions graded" value={`${gradingRate}%`} hint={`${gradedSubmissions} of ${submissionCount}`} />
        <Stat
          label="Average grade"
          value={gradeAgg._count > 0 ? `${Math.round(gradeAgg._avg.score ?? 0)}` : "—"}
          hint={gradeAgg._count > 0 ? `across ${gradeAgg._count} grades` : "no grades yet"}
        />
        <Stat label="Trial conversion" value={`${trialConversion}%`} hint={`${activeSubs} active · ${trials} on trial`} />
        <Stat label="Monthly recurring" value={mrr?._sum.price ? formatNaira(mrr._sum.price) : "—"} hint="active subscriptions" />
      </section>

      <section>
        <p className="eyebrow">Course popularity</p>
        <Card className="mt-3 space-y-4 p-6">
          {courses.map((c) => (
            <div key={c.id} className="flex items-center gap-4">
              <CourseMark slug={c.slug} size="sm" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="text-sm text-text-muted">{c._count.enrollments}</p>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-brand-1 dark:bg-brand-3"
                    style={{ width: `${Math.round((c._count.enrollments / maxEnrollment) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
