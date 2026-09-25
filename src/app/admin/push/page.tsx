import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { PushComposer } from "@/components/admin/push-composer";
import { formatDateTime } from "@/lib/format";
import { parseAudience, describeAudience } from "@/lib/campaign-sender";

export const metadata = { title: "Push notifications" };

export default async function AdminPushPage() {
  await requireStaff();

  const [campaigns, courses, subscribed] = await Promise.all([
    db.pushCampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.course.findMany({
      where: { isActive: true },
      select: { id: true, name: true, type: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    db.pushSubscription.groupBy({ by: ["userId"], _count: true }),
  ]);

  const subscribedStudents = subscribed.length;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Push notifications</h1>
        <p className="mt-1 text-sm text-text-muted">
          Send a browser push straight to students&apos; installed apps and devices. Choose the same
          audiences as email campaigns — signed up, on an elective, or signed up without a course.
        </p>
        <p className="mt-2 text-xs text-text-muted">
          {subscribedStudents} student{subscribedStudents === 1 ? "" : "s"} currently have
          notifications enabled.
        </p>
      </header>

      <Card className="p-6">
        <p className="eyebrow">New push</p>
        <div className="mt-4">
          <PushComposer courses={courses} />
        </div>
      </Card>

      <section>
        <p className="eyebrow">Recent pushes</p>
        {campaigns.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No pushes yet" body="Pushes you send will appear here." />
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {campaigns.map((c) => (
              <li key={c.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{c.title}</p>
                      <p className="mt-0.5 text-sm text-text-muted">{c.body}</p>
                      <p className="mt-2 text-xs text-text-muted">
                        {describeAudience(parseAudience(c.audience))} · {c.audienceSize ?? 0} in
                        audience · {c.sentCount} delivered
                        {c.failedCount > 0 ? ` · ${c.failedCount} failed` : ""} ·{" "}
                        {formatDateTime(c.sentAt ?? c.createdAt)}
                      </p>
                    </div>
                    <Badge tone={statusTone(c.status)}>{c.status.toLowerCase()}</Badge>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
