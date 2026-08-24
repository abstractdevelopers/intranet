import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Admin Dashboard" };

export default async function AdminDashboard() {
  await requireStaff();

  const [
    totalStudents,
    activeStudents,
    pendingApplications,
    activeCourses,
    awaitingReview,
    recentActivity,
  ] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
    db.application.count({ where: { status: "PENDING" } }),
    db.course.count({ where: { isActive: true, status: "PUBLISHED" } }),
    db.assignmentSubmission.count({ where: { status: { in: ["SUBMITTED", "RESUBMITTED"] } } }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { include: { profile: true } } },
    }),
  ]);

  const stats = [
    { label: "Total students", value: totalStudents },
    { label: "Active students", value: activeStudents },
    { label: "Pending applications", value: pendingApplications, href: "/admin/applications" },
    { label: "Active courses", value: activeCourses },
    { label: "Submissions awaiting review", value: awaitingReview, href: "/admin/submissions" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Academy Dashboard</h1>
        <p className="mt-1 text-sm text-text-muted">The operational center of the academy.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="mt-1 text-xs text-text-muted">{stat.label}</p>
          </Card>
        ))}
      </div>

      {pendingApplications > 0 ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-semibold">{pendingApplications}</span> application{pendingApplications === 1 ? "" : "s"} awaiting review.
            </p>
            <ButtonLink href="/admin/applications">Review applications</ButtonLink>
          </div>
        </Card>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold">Recent activity</h2>
        <div className="mt-3 space-y-2">
          {recentActivity.length === 0 ? (
            <Card className="p-4"><p className="text-sm text-text-muted">No administrative activity yet.</p></Card>
          ) : (
            recentActivity.map((log) => (
              <Card key={log.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div className="text-sm">
                  <span className="font-medium">{log.actor.profile?.fullName ?? log.actor.email}</span>{" "}
                  <Badge tone="neutral" className="ml-1">{log.action.replaceAll("_", " ").toLowerCase()}</Badge>
                </div>
                <span className="text-xs text-text-muted">{formatDateTime(log.createdAt)}</span>
              </Card>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
