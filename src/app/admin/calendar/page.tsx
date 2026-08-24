import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { IconAssignments, IconClock } from "@/components/icons";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Calendar" };

export default async function AdminCalendarPage() {
  await requireStaff();

  const now = new Date();
  const horizon = new Date(now.getTime() + 60 * 24 * 3600 * 1000);

  const [releases, deadlines] = await Promise.all([
    db.module.findMany({
      where: { releaseAt: { not: null, lte: horizon }, course: { isActive: true } },
      include: { course: { select: { name: true } } },
      orderBy: { releaseAt: "asc" },
      take: 50,
    }),
    db.assignment.findMany({
      where: { deadline: { not: null, lte: horizon }, module: { course: { isActive: true } } },
      include: { module: { include: { course: { select: { name: true } } } } },
      orderBy: { deadline: "asc" },
      take: 50,
    }),
  ]);

  const events = [
    ...releases.map((m) => ({
      id: `release-${m.id}`,
      date: m.releaseAt!,
      kind: "Module release" as const,
      title: `Week ${m.weekNumber}: ${m.title}`,
      context: m.course.name,
    })),
    ...deadlines.map((a) => ({
      id: `deadline-${a.id}`,
      date: a.deadline!,
      kind: "Assignment deadline" as const,
      title: a.title,
      context: `${a.module.course.name} · Week ${a.module.weekNumber}`,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
      <p className="mt-1 text-sm text-text-muted">
        Module releases and assignment deadlines across the academy, next 60 days.
      </p>

      {events.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Nothing scheduled" body="Module releases and deadlines will appear here." />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {events.map((e) => (
            <li key={e.id}>
              <Card className="flex items-center gap-4 p-4">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    e.kind === "Module release"
                      ? "bg-brand-3/25 text-brand-1 dark:text-brand-3"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                  }`}
                >
                  {e.kind === "Module release" ? (
                    <IconClock className="h-5 w-5" />
                  ) : (
                    <IconAssignments className="h-5 w-5" />
                  )}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{e.title}</p>
                  <p className="text-xs text-text-muted">{e.context}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold">{formatDateTime(e.date)}</p>
                  <p className="text-xs text-text-muted">{e.kind}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
