import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { CourseMark } from "@/components/course-mark";
import { ProgressRing } from "@/components/ui/progress-ring";
import { StudentStatusButton } from "@/components/admin/student-status-button";
import { getCourseProgress } from "@/lib/progress";
import { formatDate, formatDateTime } from "@/lib/format";

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;

  const student = await db.user.findFirst({
    where: { id, role: "STUDENT" },
    include: {
      profile: true,
      applications: { orderBy: { createdAt: "desc" }, take: 1 },
      enrollments: { include: { course: true }, orderBy: { createdAt: "asc" } },
      subscription: { include: { items: { include: { course: true } } } },
      notifications: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!student) notFound();

  const accepted = student.enrollments.filter((e) => e.status === "ACCEPTED");
  const progress = await Promise.all(accepted.map((e) => getCourseProgress(student.id, e.courseId)));
  const progressByCourse = new Map(progress.map((p) => [p.courseId, p]));

  const recentGrades = await db.grade.findMany({
    where: { submission: { userId: student.id } },
    include: { submission: { include: { assignment: true } } },
    orderBy: { gradedAt: "desc" },
    take: 8,
  });

  const application = student.applications[0] ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <nav className="text-xs text-text-muted">
        <Link href="/admin/students" className="hover:text-brand-1">Students</Link>
        <span className="mx-2">/</span>
        <span className="text-text">{student.profile?.fullName ?? student.email}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Student</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {student.profile?.fullName ?? student.email}
          </h1>
          <p className="mt-1 text-sm text-text-muted">{student.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={statusTone(student.status)}>{student.status.toLowerCase()}</Badge>
          <StudentStatusButton studentId={student.id} status={student.status} />
        </div>
      </header>

      <section>
        <p className="eyebrow">01 — Courses</p>
        {student.enrollments.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No enrollments" body="This student hasn't enrolled in any courses." />
          </div>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {student.enrollments.map((e) => {
              const p = progressByCourse.get(e.courseId);
              return (
                <Card key={e.id} className="p-5">
                  <div className="flex items-center justify-between">
                    <CourseMark slug={e.course.slug} size="sm" />
                    <Badge tone={statusTone(e.status)}>{e.status.toLowerCase()}</Badge>
                  </div>
                  <p className="mt-3 text-sm font-semibold">{e.course.name}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {e.enrollmentType.toLowerCase()} · enrolled {formatDate(e.createdAt)}
                  </p>
                  {p ? (
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-text-muted">
                        {p.completedLessons}/{p.totalLessons} lessons
                      </span>
                      <ProgressRing value={p.percent} size={40} stroke={4} />
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {application ? (
        <section>
          <p className="eyebrow">02 — Application</p>
          <Card className="mt-3 space-y-4 p-6">
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <p><span className="font-semibold">Occupation:</span> {application.currentOccupation.toLowerCase()}</p>
              <p><span className="font-semibold">Experience:</span> {application.experienceLevel.toLowerCase()}</p>
              <p><span className="font-semibold">Submitted:</span> {formatDate(application.submittedAt)}</p>
              <Badge tone={statusTone(application.status)}>{application.status.toLowerCase()}</Badge>
            </div>
            {(
              [
                ["About", application.about],
                ["Motivation", application.motivation],
                ["Goals", application.goals],
                ["Biggest challenge", application.challenge],
              ] as const
            ).map(([label, value]) =>
              value ? (
                <div key={label}>
                  <p className="text-xs font-semibold text-text-muted">{label}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{value}</p>
                </div>
              ) : null
            )}
          </Card>
        </section>
      ) : null}

      <section>
        <p className="eyebrow">03 — Recent grades</p>
        {recentGrades.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No grades yet" body="Graded work will appear here." />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {recentGrades.map((g) => (
              <li key={g.id}>
                <Card className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-semibold">{g.submission.assignment.title}</p>
                    <p className="text-xs text-text-muted">{formatDateTime(g.gradedAt)}</p>
                  </div>
                  <p className="text-lg font-bold text-brand-1 dark:text-brand-3">
                    {g.score} / {g.maxScore}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="eyebrow">04 — Membership</p>
        <Card className="mt-3 p-6">
          {student.subscription ? (
            <div className="space-y-2 text-sm">
              <p>
                <Badge tone={statusTone(student.subscription.status)}>
                  {student.subscription.status.toLowerCase()}
                </Badge>
                <span className="ml-3 text-text-muted">
                  Free month ends {formatDate(student.subscription.trialEndsAt)}
                </span>
              </p>
              <ul className="mt-3 space-y-1 border-t border-border pt-3">
                {student.subscription.items.map((i) => (
                  <li key={i.id} className="flex justify-between text-sm">
                    <span>{i.course.name}</span>
                    <span className="text-text-muted">₦{i.price.toLocaleString("en-NG")}/mo</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-text-muted">No subscription.</p>
          )}
        </Card>
      </section>
    </div>
  );
}
