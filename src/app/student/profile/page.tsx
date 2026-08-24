import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireStudent();
  const [profile, enrollments, subscription] = await Promise.all([
    db.profile.findUnique({ where: { userId: user.id } }),
    db.enrollment.findMany({ where: { userId: user.id }, include: { course: true } }),
    db.subscription.findUnique({ where: { userId: user.id } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
      <Card>
        <h2 className="text-base font-semibold">Personal information</h2>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div><dt className="text-text-muted">Full name</dt><dd className="font-medium">{profile?.fullName ?? "—"}</dd></div>
          <div><dt className="text-text-muted">Email</dt><dd className="font-medium">{user.email}</dd></div>
          <div><dt className="text-text-muted">Phone</dt><dd className="font-medium">{profile?.phone ?? "—"}</dd></div>
          <div><dt className="text-text-muted">Location</dt><dd className="font-medium">{profile?.location ?? "—"}</dd></div>
          <div><dt className="text-text-muted">Member since</dt><dd className="font-medium">{formatDate(profile?.createdAt)}</dd></div>
        </dl>
      </Card>
      <Card>
        <h2 className="text-base font-semibold">Enrollment history</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {enrollments.map((e) => (
            <li key={e.id} className="flex items-center justify-between">
              <span>{e.course.name} <span className="text-text-muted">({e.enrollmentType.toLowerCase()})</span></span>
              <Badge tone={statusTone(e.status)}>{e.status.toLowerCase()}</Badge>
            </li>
          ))}
        </ul>
      </Card>
      {subscription ? (
        <Card>
          <h2 className="text-base font-semibold">Subscription</h2>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div><dt className="text-text-muted">Status</dt><dd><Badge tone={statusTone(subscription.status)}>{subscription.status.toLowerCase()}</Badge></dd></div>
            <div><dt className="text-text-muted">Free month ends</dt><dd className="font-medium">{formatDate(subscription.trialEndsAt)}</dd></div>
            <div><dt className="text-text-muted">Billing starts</dt><dd className="font-medium">{formatDate(subscription.billingStartedAt)}</dd></div>
          </dl>
        </Card>
      ) : null}
    </div>
  );
}
