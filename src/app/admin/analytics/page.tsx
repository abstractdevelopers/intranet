import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CourseMark } from "@/components/course-mark";
import { IconHeart, IconUsers, IconAnnouncement } from "@/components/icons";
import { formatNaira } from "@/lib/format";
import { PATHWAY_LABELS, type Pathway } from "@/lib/constants";
import { getCaptainLogCompliance } from "@/lib/captains-log";

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
    pathwayRows,
    captainLogCompliance,
    projectStats,
    followCount,
    restrictedProjects,
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
    db.enrollment.groupBy({
      by: ["pathway"],
      where: { enrollmentType: "ELECTIVE", status: "ACCEPTED" },
      _count: true,
    }),
    getCaptainLogCompliance(),
    db.project.aggregate({
      _count: true,
      where: { visibility: "PUBLISHED" },
    }),
    db.follow.count(),
    db.project.count({ where: { visibility: "RESTRICTED" } }),
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

  const pathwayMix = pathwayRows
    .filter((row) => row.pathway)
    .map((row) => ({
      pathway: row.pathway as Pathway,
      label: PATHWAY_LABELS[row.pathway as Pathway] ?? row.pathway,
      count: row._count,
    }))
    .sort((a, b) => b.count - a.count);
  const maxPathway = Math.max(1, ...pathwayMix.map((p) => p.count));

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

      {/* Intranet engagement (#18) */}
      <section>
        <p className="eyebrow">Intranet engagement</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Captain's Log compliance"
            value={`${captainLogCompliance.rate}%`}
            hint={`${captainLogCompliance.submitted} of ${captainLogCompliance.due} due weeks submitted`}
          />
          <Stat
            label="Published projects"
            value={projectStats._count}
            hint={restrictedProjects > 0 ? `${restrictedProjects} restricted` : "none restricted"}
          />
          <Stat label="Creator follows" value={followCount} hint="connections made" />
          <Stat
            label="Logs awaiting review"
            value={captainLogCompliance.awaitingReview}
            hint={
              captainLogCompliance.awaitingReview > 0 ? "action needed" : "all reviewed"
            }
          />
        </div>
        {captainLogCompliance.awaitingReview > 0 ? (
          <p className="mt-3">
            <Badge tone="warning">
              {captainLogCompliance.awaitingReview} log
              {captainLogCompliance.awaitingReview === 1 ? "" : "s"} waiting on staff
            </Badge>
          </p>
        ) : null}
      </section>

      {/* Pathway mix */}
      <section>
        <p className="eyebrow">Pathway mix</p>
        <Card className="mt-3 space-y-4 p-6">
          {pathwayMix.length === 0 ? (
            <p className="text-sm text-text-muted">
              No approved electives yet, so no pathway data to show.
            </p>
          ) : (
            pathwayMix.map((p) => (
              <div key={p.pathway}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{p.label}</p>
                  <p className="text-sm text-text-muted">{p.count}</p>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-brand-1 dark:bg-brand-3"
                    style={{ width: `${Math.round((p.count / maxPathway) * 100)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </Card>
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

      <p className="flex items-center gap-1.5 text-xs text-text-muted">
        <IconAnnouncement className="h-3.5 w-3.5" />
        Captain&rsquo;s Log compliance counts every week that has been released to a student.
        <span className="mx-1">·</span>
        <IconHeart className="h-3.5 w-3.5" /> {projectStats._count} published projects
        <span className="mx-1">·</span>
        <IconUsers className="h-3.5 w-3.5" /> {followCount} follows
      </p>
    </div>
  );
}
