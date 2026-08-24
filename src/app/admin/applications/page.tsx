import Link from "next/link";
import { requireApplicationReviewer } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Applications" };

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireApplicationReviewer();
  const { status } = await searchParams;
  const filter = status && ["PENDING", "APPROVED", "REJECTED"].includes(status) ? status : "PENDING";

  const applications = await db.application.findMany({
    where: { status: filter },
    include: {
      user: { include: { profile: true } },
      selectedElective: true,
    },
    orderBy: { submittedAt: "asc" },
    take: 100,
  });

  const tabs = ["PENDING", "APPROVED", "REJECTED"];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
      <div className="mt-4 flex gap-2" role="tablist">
        {tabs.map((tab) => (
          <Link
            key={tab}
            href={`/admin/applications?status=${tab}`}
            role="tab"
            aria-selected={filter === tab}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              filter === tab ? "bg-brand-1 text-white" : "bg-surface-2 text-text-muted hover:text-text"
            }`}
          >
            {tab.charAt(0) + tab.slice(1).toLowerCase()}
          </Link>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {applications.length === 0 ? (
          <EmptyState
            title={filter === "PENDING" ? "There are no applications awaiting review." : `No ${filter.toLowerCase()} applications.`}
          />
        ) : (
          applications.map((app) => (
            <Link key={app.id} href={`/admin/applications/${app.id}`}>
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:border-brand-1/50">
                <div>
                  <p className="text-sm font-semibold">{app.user.profile?.fullName ?? app.user.email}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    Elective: {app.selectedElective.name} · Submitted {formatDateTime(app.submittedAt)}
                  </p>
                </div>
                <Badge tone={statusTone(app.status)}>{app.status.toLowerCase()}</Badge>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
