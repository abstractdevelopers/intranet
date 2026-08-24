import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { CourseMark } from "@/components/course-mark";
import { EditorForm, type EditorField } from "@/components/admin/editor-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Course editor" };

const COURSE_FIELDS: EditorField[] = [
  { kind: "text", name: "name", label: "Course name", required: true },
  { kind: "text", name: "slug", label: "Slug", required: true, placeholder: "video-editing" },
  { kind: "textarea", name: "description", label: "Description", rows: 2 },
  {
    kind: "select",
    name: "type",
    label: "Type",
    options: [
      { value: "ELECTIVE", label: "Elective" },
      { value: "COMPULSORY", label: "Compulsory" },
    ],
  },
  { kind: "number", name: "price", label: "Price (NGN / month)", required: true, min: 0 },
  { kind: "number", name: "durationWeeks", label: "Duration (weeks)", min: 1 },
  {
    kind: "select",
    name: "status",
    label: "Status",
    options: [
      { value: "DRAFT", label: "Draft" },
      { value: "PUBLISHED", label: "Published" },
      { value: "ARCHIVED", label: "Archived" },
    ],
  },
];

const MODULE_FIELDS: EditorField[] = [
  { kind: "text", name: "title", label: "Module title", required: true, placeholder: "Foundations of Visual Storytelling" },
  { kind: "number", name: "weekNumber", label: "Week number", required: true, min: 1 },
  { kind: "textarea", name: "overview", label: "Overview", rows: 2 },
  { kind: "textarea", name: "objectives", label: "Learning objectives", rows: 3 },
  {
    kind: "select",
    name: "status",
    label: "Status",
    options: [
      { value: "DRAFT", label: "Draft" },
      { value: "PUBLISHED", label: "Published" },
    ],
  },
  { kind: "datetime", name: "releaseAt", label: "Release date (empty = immediate)" },
];

export default async function CourseEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;

  const course = await db.course.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { _count: { select: { lessons: true, assignments: true } } },
      },
      _count: { select: { enrollments: true } },
    },
  });
  if (!course) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <nav className="text-xs text-text-muted">
        <Link href="/admin/courses" className="hover:text-brand-1">Courses</Link>
        <span className="mx-2">/</span>
        <span className="text-text">{course.name}</span>
      </nav>

      <header className="flex flex-wrap items-center gap-4">
        <CourseMark slug={course.slug} size="lg" />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{course.name}</h1>
            <Badge tone={statusTone(course.status)}>{course.status.toLowerCase()}</Badge>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {course._count.enrollments} students · {course.modules.length} weeks
          </p>
        </div>
      </header>

      <section>
        <p className="eyebrow">Course settings</p>
        <Card className="mt-3 p-6">
          <EditorForm
            endpoint={`/api/admin/courses/${course.id}`}
            method="PATCH"
            fields={COURSE_FIELDS}
            initial={{
              name: course.name,
              slug: course.slug,
              description: course.description,
              type: course.type,
              price: course.price,
              durationWeeks: course.durationWeeks,
              status: course.status,
            }}
            submitLabel="Save course"
          />
        </Card>
      </section>

      <section>
        <p className="eyebrow">Modules</p>
        {course.modules.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No modules yet" body="Add the first week below." />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {course.modules.map((m) => (
              <li key={m.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-semibold">
                      Week {String(m.weekNumber).padStart(2, "0")} · {m.title}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {m._count.lessons} lessons · {m._count.assignments} assignments
                      {m.releaseAt ? ` · releases ${formatDate(m.releaseAt)}` : " · immediate access"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={statusTone(m.status)}>{m.status.toLowerCase()}</Badge>
                    <Link
                      href={`/admin/courses/${course.id}/modules/${m.id}`}
                      className="rounded-lg bg-brand-1 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-2"
                    >
                      Edit content
                    </Link>
                    <DeleteButton
                      endpoint={`/api/admin/modules/${m.id}`}
                      confirmMessage={`Delete Week ${m.weekNumber} (${m.title}) and all its lessons?`}
                    />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="eyebrow">Add module</p>
        <Card className="mt-3 p-6">
          <EditorForm
            endpoint={`/api/admin/courses/${course.id}/modules`}
            fields={MODULE_FIELDS}
            submitLabel="Create module"
          />
        </Card>
      </section>
    </div>
  );
}
