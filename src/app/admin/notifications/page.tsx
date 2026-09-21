import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { NotificationAdminList, NotificationRowDelete } from "@/components/admin/notification-admin-list";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Notifications" };

const PER_PAGE = 50;

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string }>;
}) {
  await requireStaff();
  const params = await searchParams;
  const type = params.type?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const where = type ? { type } : {};

  const [notifications, total, types] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true, type: true, title: true, body: true, readAt: true, createdAt: true,
        user: { select: { email: true } },
      },
    }),
    db.notification.count({ where }),
    db.notification.groupBy({ by: ["type"], _count: true, orderBy: { _count: { type: "desc" } } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="mt-1 text-sm text-text-muted">
          Everything sent into student portals. Deleting a notification removes it from the
          student&apos;s list — it does not unsend any email that already went out.
        </p>
      </header>

      <NotificationAdminList
        notifications={notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          read: Boolean(n.readAt),
          createdAtLabel: formatDateTime(n.createdAt),
          userEmail: n.user.email,
        }))}
        types={types.map((t) => ({ type: t.type, count: t._count }))}
        activeType={type}
      />

      <section>
        <p className="eyebrow">Breakdown by type</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {types.map((t) => (
            <a key={t.type} href={`/admin/notifications?type=${encodeURIComponent(t.type)}`}>
              <Badge tone={type === t.type ? "brand" : "neutral"}>
                {t.type.replaceAll("_", " ").toLowerCase()} · {t._count}
              </Badge>
            </a>
          ))}
          {type ? (
            <a href="/admin/notifications">
              <Badge tone="neutral">clear filter</Badge>
            </a>
          ) : null}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <p className="eyebrow">
            {type ? type.replaceAll("_", " ").toLowerCase() : "All notifications"}
          </p>
          <p className="text-xs text-text-muted">
            {total} total · page {page} of {totalPages}
          </p>
        </div>

        {notifications.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No notifications" body="Nothing matches this filter." />
          </div>
        ) : (
          <Card className="mt-3 divide-y divide-border p-0">
            {notifications.map((n) => (
              <div key={n.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{n.title}</p>
                    <Badge tone="neutral">{n.type.replaceAll("_", " ").toLowerCase()}</Badge>
                    {n.readAt ? null : <Badge tone="brand">unread</Badge>}
                  </div>
                  {n.body ? <p className="mt-1 text-sm text-text-muted">{n.body}</p> : null}
                  <p className="mt-1.5 text-xs text-text-muted">
                    {n.user.email} · {formatDateTime(n.createdAt)}
                  </p>
                </div>
                <NotificationRowDelete id={n.id} />
              </div>
            ))}
          </Card>
        )}

        {totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between">
            {page > 1 ? (
              <a
                className="text-sm font-medium text-brand-1 hover:underline dark:text-brand-3"
                href={`/admin/notifications?${new URLSearchParams({ ...(type ? { type } : {}), page: String(page - 1) })}`}
              >
                ← Newer
              </a>
            ) : (
              <span />
            )}
            {page < totalPages ? (
              <a
                className="text-sm font-medium text-brand-1 hover:underline dark:text-brand-3"
                href={`/admin/notifications?${new URLSearchParams({ ...(type ? { type } : {}), page: String(page + 1) })}`}
              >
                Older →
              </a>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}