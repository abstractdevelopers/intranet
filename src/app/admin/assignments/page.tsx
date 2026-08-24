import Link from "next/link";
import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { IconArrowRight } from "@/components/icons";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Assignments" };

/** Every assignment across the academy, with submission counts and a link into its module editor. */
export default async function AdminAssignmentsPage() {
  await requireStaff();

  const assignments = await db.assignment.findMany({
    include: {
      module: { include: { course: { select: { id: true, name: true } } } },
      _count: { select: { submissions: true } },
    },
    orderBy: [{ module: { course: { name: "asc" } } }, { module: { weekNumber: "asc" } }],
    take: 200,
  });

  const byCourse = new Map<string, { course: { id: string; name: string }; items: typeof assignments }>();
  for (const a of assignments) {
    const key = a.module.course.id;
    const entry = byCourse.get(key) ?? { course: a.module.course, items: [] };
    entry.items.push(a);
    byCourse.set(key, entry);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Assignments</h1>
        <p className="mt-1 text-sm text-text-muted">
          Assignments belong to modules — create and edit them in the course editor. This is the overview.
        </p>
      </header>

      {byCourse.size === 0 ? (
        <EmptyState
          title="No assignments yet"
          body="Open a course, then a module, and create the first assignment there."
        />
      ) : (
        [...byCourse.values()].map(({ course, items }) => (
          <section key={course.id}>
            <p className="eyebrow">{course.name}</p>
            <ul className="mt-3 space-y-2">
              {items.map((a) => (
                <li key={a.id}>
                  <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="text-sm font-semibold">{a.title}</p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        Week {a.module.weekNumber} · {a.maxScore} pts
                        {a.deadline ? ` · due ${formatDate(a.deadline)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone="neutral">{a._count.submissions} submissions</Badge>
                      <Link
                        href={`/admin/courses/${course.id}/modules/${a.moduleId}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-1 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-2"
                      >
                        Edit in module <IconArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
