import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const user = await requireStudent();
  const enrollments = await db.enrollment.findMany({
    where: { userId: user.id, status: "ACCEPTED" },
    select: { courseId: true },
  });
  const courseIds = enrollments.map((e) => e.courseId);

  const [deadlines, releases] = courseIds.length
    ? await Promise.all([
        db.assignment.findMany({
          where: { module: { courseId: { in: courseIds } }, deadline: { not: null } },
          include: { module: { include: { course: true } } },
          orderBy: { deadline: "asc" },
          take: 20,
        }),
        db.module.findMany({
          where: { courseId: { in: courseIds }, releaseAt: { gt: new Date() } },
          include: { course: true },
          orderBy: { releaseAt: "asc" },
          take: 20,
        }),
      ])
    : [[], []];

  const events = await db.event.findMany({
    where: {
      OR: [
        { audience: "ACADEMY" },
        ...(courseIds.length ? [{ audience: "COURSE", courseId: { in: courseIds } }] : []),
      ],
    },
    include: { course: { select: { name: true } } },
    orderBy: { date: "asc" },
    take: 20,
  });

  const hasEvents = deadlines.length > 0 || releases.length > 0 || events.length > 0;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
      <div className="mt-6 space-y-6">
        {!hasEvents ? (
          <EmptyState title="Nothing scheduled" body="Deadlines, module releases and academy events will appear here." />
        ) : (
          <>
            {events.length > 0 ? (
              <section>
                <h2 className="text-lg font-semibold">Academy events</h2>
                <div className="mt-3 space-y-2">
                  {events.map((e) => (
                    <Card key={e.id} className="p-4">
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {e.audience === "ACADEMY" ? "Entire academy" : (e.course?.name ?? "Course")} · {formatDateTime(e.date)}
                      </p>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}
            {releases.length > 0 ? (
              <section>
                <h2 className="text-lg font-semibold">Upcoming module releases</h2>
                <div className="mt-3 space-y-2">
                  {releases.map((m) => (
                    <Card key={m.id} className="p-4">
                      <p className="text-sm font-medium">{m.course.name} · Week {m.weekNumber}: {m.title}</p>
                      <p className="mt-0.5 text-xs text-text-muted">Unlocks {formatDateTime(m.releaseAt)}</p>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}
            {deadlines.length > 0 ? (
              <section>
                <h2 className="text-lg font-semibold">Assignment deadlines</h2>
                <div className="mt-3 space-y-2">
                  {deadlines.map((a) => (
                    <Card key={a.id} className="p-4">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {a.module.course.name} · Due {formatDateTime(a.deadline)}
                      </p>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
