import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { EditorForm, type EditorField } from "@/components/admin/editor-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { IconAssignments, IconCalendar, IconClock } from "@/components/icons";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Calendar" };

export default async function AdminCalendarPage() {
  await requireStaff();

  const now = new Date();
  const horizon = new Date(now.getTime() + 60 * 24 * 3600 * 1000);

  const [events, releases, deadlines, courses] = await Promise.all([
    db.event.findMany({
      include: { course: { select: { name: true } }, creator: { include: { profile: true } } },
      orderBy: { date: "asc" },
      take: 50,
    }),
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
    db.course.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const scheduled = [
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

  const EVENT_FIELDS: EditorField[] = [
    { kind: "text", name: "title", label: "Event title", required: true, placeholder: "Live Q&A: week one" },
    { kind: "datetime", name: "date", label: "Date & time" },
    {
      kind: "select",
      name: "audience",
      label: "Audience",
      options: [
        { value: "ACADEMY", label: "Entire academy" },
        { value: "COURSE", label: "Specific course" },
      ],
    },
    {
      kind: "select",
      name: "courseId",
      label: "Course (when audience is a course)",
      options: courses.map((c) => ({ value: c.id, label: c.name })),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        <p className="mt-1 text-sm text-text-muted">
          Academy events you create, plus module releases and deadlines pulled from your courses.
        </p>
      </header>

      <section>
        <p className="eyebrow">Events</p>
        <Card className="mt-3 p-6">
          <p className="text-xs font-semibold text-text-muted">New event (workshops, live sessions, key dates)</p>
          <div className="mt-4">
            <EditorForm endpoint="/api/admin/events" fields={EVENT_FIELDS} submitLabel="Add event" />
          </div>
        </Card>

        {events.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No events yet" body="Workshops and key dates you add will appear here." />
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {events.map((e) => (
              <li key={e.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-3/25 text-brand-1 dark:text-brand-3">
                        <IconCalendar className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{e.title}</p>
                        <p className="text-xs text-text-muted">
                          {formatDateTime(e.date)} · by {e.creator.profile?.fullName ?? e.creator.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone={e.audience === "ACADEMY" ? "brand" : "neutral"}>
                        {e.audience === "ACADEMY" ? "Academy" : e.course?.name ?? "Course"}
                      </Badge>
                      <DeleteButton endpoint={`/api/admin/events/${e.id}`} confirmMessage={`Delete "${e.title}"?`} />
                    </div>
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-brand-1 dark:text-brand-3">
                      Edit event
                    </summary>
                    <div className="mt-4 border-t border-border pt-4">
                      <EditorForm
                        endpoint={`/api/admin/events/${e.id}`}
                        method="PATCH"
                        fields={EVENT_FIELDS}
                        initial={{
                          title: e.title,
                          date: e.date.toISOString(),
                          audience: e.audience,
                          courseId: e.courseId ?? courses[0]?.id ?? "",
                        }}
                        submitLabel="Save event"
                      />
                    </div>
                  </details>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="eyebrow">From your courses</p>
        <p className="mt-1 text-sm text-text-muted">
          Module releases and assignment deadlines appear automatically. Edit them in the course editor.
        </p>
        {scheduled.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="Nothing scheduled" body="Set module release dates and assignment deadlines in the course editor." />
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {scheduled.map((e) => (
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
      </section>
    </div>
  );
}
