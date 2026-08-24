import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";

export const metadata = { title: "UCA Workspace" };

export default async function WorkspacePage() {
  const user = await requireStudent();
  const workspaces = await db.workspace.findMany({
    where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight">UCA Workspace</h1>
      <p className="mt-1 text-sm text-text-muted">
        Your cloud-based working environment for course projects and assignments.
      </p>
      <div className="mt-6">
        {workspaces.length === 0 ? (
          <EmptyState
            title="Your workspace is being prepared"
            body="Workspace provisioning is rolling out. Your projects, files and development environment will live here."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {workspaces.map((w) => (
              <Card key={w.id}>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-semibold">{w.name}</h2>
                  <Badge tone={statusTone(w.status)}>{w.status.toLowerCase()}</Badge>
                </div>
                <p className="mt-1 text-sm text-text-muted">Provider: {w.provider}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
