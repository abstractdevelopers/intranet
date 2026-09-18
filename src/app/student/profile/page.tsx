import Link from "next/link";
import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ProfileEditor } from "@/components/creators/profile-editor";
import { Avatar } from "@/components/creators/avatar";
import { IconUsers, IconCourses } from "@/components/icons";
import { USERNAME_CHANGE_COOLDOWN_DAYS, usernameCooldownMs } from "@/lib/auth";
import { getStudentPathway } from "@/lib/communities";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireStudent();
  const [profile, enrollments, subscription, pathway, counts] = await Promise.all([
    db.profile.findUnique({ where: { userId: user.id } }),
    db.enrollment.findMany({
      where: { userId: user.id },
      include: { course: true },
      orderBy: { createdAt: "asc" },
    }),
    db.subscription.findUnique({ where: { userId: user.id } }),
    getStudentPathway(user.id),
    db.user.findUnique({
      where: { id: user.id },
      select: {
        _count: {
          select: {
            followers: true,
            following: true,
            projects: { where: { visibility: "PUBLISHED" } },
          },
        },
      },
    }),
  ]);

  const changedAt = await db.user.findUnique({
    where: { id: user.id },
    select: { usernameChangedAt: true },
  });
  const cooldownMs = usernameCooldownMs(changedAt?.usernameChangedAt ?? null);
  const canChangeUsername = cooldownMs === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Profile</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Your creator profile</h1>
          <p className="mt-1 max-w-xl text-sm text-text-muted">
            This is what other students see when they discover you.
          </p>
        </div>
        {user.username ? (
          <ButtonLink href={`/student/creators/${user.username}`} variant="secondary">
            View as others see it
          </ButtonLink>
        ) : null}
      </header>

      {counts ? (
        <Card className="flex flex-wrap items-center gap-6">
          <Avatar
            documentId={profile?.avatarDocumentId ?? null}
            name={profile?.fullName ?? user.fullName}
          />
          <div className="flex flex-1 flex-wrap gap-6 text-sm">
            <span className="inline-flex items-center gap-1.5 text-text-muted">
              <IconCourses className="h-4 w-4" />
              <span className="font-semibold text-text">{counts._count.projects}</span> public projects
            </span>
            <span className="inline-flex items-center gap-1.5 text-text-muted">
              <IconUsers className="h-4 w-4" />
              <span className="font-semibold text-text">{counts._count.followers}</span> followers
            </span>
            <span className="inline-flex items-center gap-1.5 text-text-muted">
              <IconUsers className="h-4 w-4" />
              <span className="font-semibold text-text">{counts._count.following}</span> following
            </span>
          </div>
          {pathway.label ? <Badge tone="brand">{pathway.label}</Badge> : null}
        </Card>
      ) : null}

      <section>
        <p className="eyebrow">01 — Public profile</p>
        <Card className="mt-4 p-6">
          <ProfileEditor
            initial={{
              username: user.username ?? "",
              fullName: profile?.fullName ?? user.fullName,
              headline: profile?.headline ?? "",
              bio: profile?.bio ?? "",
              location: profile?.location ?? "",
              phone: profile?.phone ?? "",
              avatarDocumentId: profile?.avatarDocumentId ?? null,
            }}
            canChangeUsername={canChangeUsername}
          />
        </Card>
        <p className="mt-2 text-xs text-text-muted">
          Usernames are limited to one change every {USERNAME_CHANGE_COOLDOWN_DAYS} days to
          prevent impersonation and confusion.
        </p>
      </section>

      <section>
        <p className="eyebrow">02 — Academy record</p>
        <Card className="mt-4">
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-text-muted">Email</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Member since</dt>
              <dd className="font-medium">{formatDate(profile?.createdAt)}</dd>
            </div>
          </dl>
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Enrollment history
          </p>
          <ul className="mt-2 space-y-2 text-sm">
            {enrollments.map((e) => (
              <li key={e.id} className="flex items-center justify-between">
                <span>
                  {e.course.name}{" "}
                  <span className="text-text-muted">
                    ({e.enrollmentType.toLowerCase()})
                  </span>
                </span>
                <Badge tone={statusTone(e.status)}>{e.status.toLowerCase()}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {subscription ? (
        <section>
          <p className="eyebrow">03 — Membership</p>
          <Card className="mt-4">
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <dt className="text-text-muted">Status</dt>
                <dd>
                  <Badge tone={statusTone(subscription.status)}>
                    {subscription.status.toLowerCase()}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Free month ends</dt>
                <dd className="font-medium">{formatDate(subscription.trialEndsAt)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-text-muted">
              <Link href="/student/billing" className="underline-offset-2 hover:underline">
                Manage billing
              </Link>
            </p>
          </Card>
        </section>
      ) : null}
    </div>
  );
}