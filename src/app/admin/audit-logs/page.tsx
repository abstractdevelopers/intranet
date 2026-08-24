import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Audit Logs" };

export default async function AuditLogsPage() {
  await requireStaff();
  const logs = await db.auditLog.findMany({
    include: { actor: { include: { profile: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
      <p className="mt-1 text-sm text-text-muted">A record of important administrative actions.</p>
      <div className="mt-6 space-y-2">
        {logs.length === 0 ? (
          <EmptyState title="No activity logged yet" body="Administrative actions will be recorded here." />
        ) : (
          logs.map((log) => (
            <Card key={log.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div className="text-sm">
                <span className="font-medium">{log.actor.profile?.fullName ?? log.actor.email}</span>{" "}
                <Badge tone="neutral" className="ml-1">{log.action.replaceAll("_", " ").toLowerCase()}</Badge>
                {log.targetType ? <span className="ml-2 text-xs text-text-muted">{log.targetType}</span> : null}
              </div>
              <span className="text-xs text-text-muted">{formatDateTime(log.createdAt)}</span>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
