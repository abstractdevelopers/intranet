import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/ui/empty";
import { NotificationList } from "@/components/notification-list";
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
      {notifications.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="You're all up to date." />
        </div>
      ) : (
        <NotificationList
          notifications={notifications.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            createdAt: n.createdAt.toISOString(),
            readAt: n.readAt?.toISOString() ?? null,
          }))}
          formatDateTime={formatDateTime}
        />
      )}
    </div>
  );
}
