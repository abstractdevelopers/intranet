import Link from "next/link";
import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { CaptainLogReview } from "@/components/admin/captain-log-review";
import { CaptainLogAnswers } from "@/components/captains-log/captain-log-answers";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Captain's Logs" };

export default async function AdminCaptainLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireStaff();
  const { status = "", q = "" } = await searchParams;
  const query = q.trim();

  const logs = await db.captainLog.findMany({
    where: {
      ...(status === "SUBMITTED" || status === "REVIEWED" ? { status } : {}),
      ...(query
        ? {
            user: {
              OR: [
                { username: { contains: query, mode: "insensitive" } },
                { profile: { fullName: { contains: query, mode: "insensitive" } } },
              ],
            },
          }
        : {}),
    },
    include: {
      user: { select: { id: true, username: true, profile: { select: { fullName: true } } } },
      reviewedBy: { select: { profile: { select: { fullName: true } } } },
    },
    orderBy: [{ submittedAt: "desc" }],
    take: 100,
  });

  const pending = logs.filter((l) => l.status === "SUBMITTED").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Students</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Captain&rsquo;s Logs</h1>
          <p className="mt-1 text-sm text-text-muted">
            Weekly reflections from students, newest first.
          </p>
        </div>
        {pending > 0 ? <Badge tone="warning">{pending} awaiting review</Badge> : null}
      </header>

      <form method="get" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by student…"
          aria-label="Search logs"
          className="w-full max-w-sm rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus:border-brand-1 focus:outline-2 focus:outline-brand-3"
        />
        <select
          name="status"
          defaultValue={status}
          aria-label="Filter by status"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="SUBMITTED">Awaiting review</option>
          <option value="REVIEWED">Reviewed</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-brand-1 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-2"
        >
          Filter
        </button>
      </form>

      {logs.length === 0 ? (
        <EmptyState
          title="No Captain's Logs found"
          body={query || status ? "Try a different filter." : "Logs will appear here as students submit them."}
        />
      ) : (
        <div className="space-y-4">
          {logs.map((log) => {
            const name = log.user.profile?.fullName ?? log.user.username ?? "Student";
            return (
              <Card key={log.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {name}
                      {log.user.username ? (
                        <span className="ml-2 font-normal text-text-muted">@{log.user.username}</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      Week {log.weekNumber} · submitted {formatDateTime(log.submittedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={log.status === "REVIEWED" ? "success" : "warning"}>
                      {log.status === "REVIEWED" ? "reviewed" : "awaiting review"}
                    </Badge>
                    <Link
                      href={`/admin/students/${log.user.id}`}
                      className="text-xs font-semibold text-brand-1 hover:underline dark:text-brand-3"
                    >
                      View student
                    </Link>
                  </div>
                </div>

                <CaptainLogAnswers responses={log.responses} />

                {log.reviewNote ? (
                  <p className="mt-3 rounded-lg bg-surface-2 p-3 text-sm text-text-muted">
                    <span className="font-semibold">Note sent:</span> {log.reviewNote}
                    {log.reviewedBy?.profile?.fullName ? (
                      <span className="ml-1 opacity-70">— {log.reviewedBy.profile.fullName}</span>
                    ) : null}
                  </p>
                ) : null}

                <CaptainLogReview logId={log.id} reviewed={log.status === "REVIEWED"} />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}