import Link from "next/link";
import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { EditorForm, type EditorField } from "@/components/admin/editor-form";
import { formatNaira } from "@/lib/format";

export const metadata = { title: "Courses" };

const NEW_COURSE_FIELDS: EditorField[] = [
  { kind: "text", name: "name", label: "Course name", required: true },
  { kind: "text", name: "slug", label: "Slug", required: true, placeholder: "data-analysis" },
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
];

export default async function AdminCoursesPage() {
  await requireStaff();
  const courses = await db.course.findMany({
    include: {
      _count: { select: { enrollments: true, modules: true } },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Courses</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <Link key={course.id} href={`/admin/courses/${course.id}`} className="block">
            <Card className="h-full transition-colors hover:border-brand-1/40">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold">{course.name}</h2>
                <Badge tone={statusTone(course.status)}>{course.status.toLowerCase()}</Badge>
              </div>
              <p className="mt-1 text-sm text-text-muted">{course.description}</p>
              <dl className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-text-muted">Type</dt><dd className="capitalize">{course.type.toLowerCase()}</dd></div>
                <div className="flex justify-between"><dt className="text-text-muted">Price</dt><dd>{formatNaira(course.price)}/month</dd></div>
                <div className="flex justify-between"><dt className="text-text-muted">Enrollments</dt><dd>{course._count.enrollments}</dd></div>
                <div className="flex justify-between"><dt className="text-text-muted">Modules</dt><dd>{course._count.modules}</dd></div>
              </dl>
            </Card>
          </Link>
        ))}
      </div>

      <section>
        <p className="eyebrow">New course</p>
        <Card className="mt-3 max-w-xl p-6">
          <EditorForm
            endpoint="/api/admin/courses"
            fields={NEW_COURSE_FIELDS}
            submitLabel="Create course"
          />
        </Card>
      </section>
    </div>
  );
}
