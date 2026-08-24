import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireStudent();
  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
      <div className="mt-6 space-y-2">
        {notifications.length === 0 ? (
          <EmptyState title="You're all up to date." />
        ) : (
          notifications.map((n) => (
            <Card key={n.id} className={`p-4 ${n.readAt ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body ? <p className="mt-0.5 text-sm text-text-muted">{n.body}</p> : null}
                </div>
                <span className="shrink-0 text-xs text-text-muted">{formatDateTime(n.createdAt)}</span>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
