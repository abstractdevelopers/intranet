import { notFound } from "next/navigation";
import { requireApplicationReviewer } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/format";
import { ReviewActions } from "./review-actions";

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireApplicationReviewer();
  const { id } = await params;

  const application = await db.application.findUnique({
    where: { id },
    include: {
      user: { include: { profile: true } },
      selectedElective: true,
      reviewedBy: { include: { profile: true } },
    },
  });
  if (!application) notFound();

  const enrollments = await db.enrollment.findMany({
    where: { userId: application.userId },
    include: { course: true },
  });
  const compulsory = enrollments.filter((e) => e.enrollmentType === "COMPULSORY");

  const occupationLabel = application.currentOccupation.replaceAll("_", " ").toLowerCase();
  const experienceLabel = application.experienceLevel.toLowerCase();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Enrollment Application</h1>
          <p className="mt-1 text-sm text-text-muted">Submitted {formatDateTime(application.submittedAt)}</p>
        </div>
        <Badge tone={statusTone(application.status)}>{application.status.toLowerCase()}</Badge>
      </div>

      <Card>
        <h2 className="text-base font-semibold">Student</h2>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div><dt className="text-text-muted">Full name</dt><dd className="font-medium">{application.user.profile?.fullName ?? "—"}</dd></div>
          <div><dt className="text-text-muted">Email</dt><dd className="font-medium">{application.user.email}</dd></div>
          <div><dt className="text-text-muted">Phone</dt><dd className="font-medium">{application.user.profile?.phone ?? "—"}</dd></div>
          <div><dt className="text-text-muted">Location</dt><dd className="font-medium">{application.user.profile?.location ?? "—"}</dd></div>
          <div><dt className="text-text-muted">Date of birth</dt><dd className="font-medium">{formatDate(application.user.profile?.dateOfBirth)}</dd></div>
          <div><dt className="text-text-muted">Currently</dt><dd className="font-medium capitalize">{occupationLabel}</dd></div>
          <div><dt className="text-text-muted">Experience</dt><dd className="font-medium capitalize">{experienceLabel}</dd></div>
        </dl>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Courses</h2>
        <div className="mt-4 space-y-2 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Compulsory courses</p>
          {compulsory.map((e) => (
            <p key={e.id} className="flex items-center gap-2">
              <span className="text-brand-1 dark:text-brand-3">✓</span> {e.course.name}
              <Badge tone={statusTone(e.status)} className="ml-1">{e.status.toLowerCase()}</Badge>
            </p>
          ))}
          <p className="pt-2 text-xs font-medium uppercase tracking-wide text-text-muted">Elective</p>
          <p className="flex items-center gap-2">
            <span aria-hidden>⏳</span> {application.selectedElective.name}
            <Badge tone={statusTone(application.status)} className="ml-1">{application.status.toLowerCase()}</Badge>
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Application responses</h2>
        <div className="mt-4 space-y-4 text-sm">
          <div>
            <p className="font-medium">About</p>
            <p className="mt-1 whitespace-pre-wrap text-text-muted">{application.about}</p>
          </div>
          <div>
            <p className="font-medium">Why do you want to join the academy?</p>
            <p className="mt-1 whitespace-pre-wrap text-text-muted">{application.motivation}</p>
          </div>
          <div>
            <p className="font-medium">What do you hope to achieve during the program?</p>
            <p className="mt-1 whitespace-pre-wrap text-text-muted">{application.goals}</p>
          </div>
          <div>
            <p className="font-medium">Biggest current challenge</p>
            <p className="mt-1 whitespace-pre-wrap text-text-muted">{application.challenge}</p>
          </div>
        </div>
      </Card>

      {application.status === "PENDING" ? (
        <ReviewActions applicationId={application.id} electiveName={application.selectedElective.name} />
      ) : (
        <Card>
          <p className="text-sm text-text-muted">
            Reviewed {formatDateTime(application.reviewedAt)}
            {application.reviewedBy ? ` by ${application.reviewedBy.profile?.fullName ?? application.reviewedBy.email}` : ""}.
          </p>
        </Card>
      )}
    </div>
  );
}
