import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { EditorForm, type EditorField } from "@/components/admin/editor-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { ResourceForm } from "@/components/admin/resource-form";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Module editor" };

const MODULE_FIELDS: EditorField[] = [
  { kind: "text", name: "title", label: "Module title", required: true },
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

const LESSON_FIELDS: EditorField[] = [
  { kind: "text", name: "title", label: "Lesson title", required: true },
  { kind: "textarea", name: "content", label: "Reading content", rows: 6 },
  { kind: "text", name: "youtubeVideoId", label: "YouTube video ID", placeholder: "O6ERELse_QY" },
  { kind: "number", name: "durationMin", label: "Duration (minutes)", min: 0 },
];

const SUBMISSION_TYPES = ["PDF", "DOC", "DOCX", "ZIP", "IMAGE", "TEXT", "GITHUB", "GITLAB", "URL", "REPO"];

const ASSIGNMENT_FIELDS: EditorField[] = [
  { kind: "text", name: "title", label: "Assignment title", required: true },
  { kind: "textarea", name: "description", label: "Brief", rows: 3 },
  { kind: "textarea", name: "instructions", label: "Instructions", rows: 3 },
  { kind: "textarea", name: "requirements", label: "Requirements", rows: 3 },
  { kind: "datetime", name: "deadline", label: "Deadline (empty = none)" },
  { kind: "number", name: "maxScore", label: "Maximum score", min: 1 },
  { kind: "multiselect", name: "allowedTypes", label: "Allowed submission types", options: SUBMISSION_TYPES },
  { kind: "number", name: "maxFileSizeMb", label: "Max file size (MB)", min: 1 },
  { kind: "number", name: "maxAttempts", label: "Attempts allowed", min: 1 },
  {
    kind: "select",
    name: "latePolicy",
    label: "Late submissions",
    options: [
      { value: "ALLOW", label: "Allow" },
      { value: "PENALTY", label: "Allow with penalty" },
      { value: "BLOCK", label: "Block after deadline" },
    ],
  },
];

function parseAllowed(raw: string): string[] {
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p.map(String);
  } catch {
    /* fall through */
  }
  return raw.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
}

export default async function ModuleEditorPage({
  params,
}: {
  params: Promise<{ id: string; moduleId: string }>;
}) {
  await requireStaff();
  const { id, moduleId } = await params;

  const mod = await db.module.findFirst({
    where: { id: moduleId, courseId: id },
    include: {
      course: { select: { name: true } },
      lessons: { orderBy: { order: "asc" }, include: { resources: true } },
      assignments: { orderBy: { createdAt: "asc" }, include: { _count: { select: { submissions: true } } } },
    },
  });
  if (!mod) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <nav className="text-xs text-text-muted">
        <Link href="/admin/courses" className="hover:text-brand-1">Courses</Link>
        <span className="mx-2">/</span>
        <Link href={`/admin/courses/${id}`} className="hover:text-brand-1">{mod.course.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-text">Week {mod.weekNumber}</span>
      </nav>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          Week {String(mod.weekNumber).padStart(2, "0")} · {mod.title}
        </h1>
        <Badge tone={statusTone(mod.status)}>{mod.status.toLowerCase()}</Badge>
      </header>

      <section>
        <p className="eyebrow">Module settings</p>
        <Card className="mt-3 p-6">
          <EditorForm
            endpoint={`/api/admin/modules/${mod.id}`}
            method="PATCH"
            fields={MODULE_FIELDS}
            initial={{
              title: mod.title,
              weekNumber: mod.weekNumber,
              overview: mod.overview ?? "",
              objectives: mod.objectives ?? "",
              status: mod.status,
              releaseAt: mod.releaseAt?.toISOString() ?? "",
            }}
            submitLabel="Save module"
          />
        </Card>
      </section>

      <section>
        <p className="eyebrow">Lessons</p>
        <div className="mt-3 space-y-4">
          {mod.lessons.map((lesson) => (
            <Card key={lesson.id} className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold">
                  {lesson.order}. {lesson.title}
                </p>
                <div className="flex items-center gap-2">
                  {lesson.youtubeVideoId ? <Badge tone="brand">video</Badge> : null}
                  {lesson.durationMin ? <Badge tone="neutral">{lesson.durationMin} min</Badge> : null}
                  <DeleteButton endpoint={`/api/admin/lessons/${lesson.id}`} />
                </div>
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer text-xs font-semibold text-brand-1 dark:text-brand-3">
                  Edit lesson
                </summary>
                <div className="mt-4 border-t border-border pt-4">
                  <EditorForm
                    endpoint={`/api/admin/lessons/${lesson.id}`}
                    method="PATCH"
                    fields={LESSON_FIELDS}
                    initial={{
                      title: lesson.title,
                      content: lesson.content ?? "",
                      youtubeVideoId: lesson.youtubeVideoId ?? "",
                      durationMin: lesson.durationMin ?? "",
                    }}
                    submitLabel="Save lesson"
                  />
                </div>
              </details>

              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs font-semibold text-text-muted">Resources</p>
                {lesson.resources.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {lesson.resources.map((r) => (
                      <li key={r.id} className="flex items-center justify-between text-sm">
                        <span>
                          {r.title}{" "}
                          <span className="text-xs uppercase text-text-muted">· {r.type}</span>
                        </span>
                        <DeleteButton
                          endpoint={`/api/admin/resources/${r.id}`}
                          label="Remove"
                          confirmMessage={`Remove "${r.title}"?`}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-text-muted">No resources yet.</p>
                )}
                <div className="mt-3 rounded-lg bg-surface-2 p-4">
                  <ResourceForm lessonId={lesson.id} />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="mt-4 p-6">
          <p className="text-xs font-semibold text-text-muted">New lesson</p>
          <div className="mt-3">
            <EditorForm
              endpoint={`/api/admin/modules/${mod.id}/lessons`}
              fields={LESSON_FIELDS}
              submitLabel="Add lesson"
            />
          </div>
        </Card>
      </section>

      <section>
        <p className="eyebrow">Assignments</p>
        <div className="mt-3 space-y-4">
          {mod.assignments.map((a) => (
            <Card key={a.id} className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold">{a.title}</p>
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{a.maxScore} pts</Badge>
                  <Badge tone="neutral">{a._count.submissions} submissions</Badge>
                  {a.deadline ? <Badge tone="warning">due {formatDateTime(a.deadline)}</Badge> : null}
                  <DeleteButton endpoint={`/api/admin/assignments/${a.id}`} />
                </div>
              </div>
              <p className="mt-2 text-sm text-text-muted">{a.description}</p>
              <details className="mt-4">
                <summary className="cursor-pointer text-xs font-semibold text-brand-1 dark:text-brand-3">
                  Edit assignment
                </summary>
                <div className="mt-4 border-t border-border pt-4">
                  <EditorForm
                    endpoint={`/api/admin/assignments/${a.id}`}
                    method="PATCH"
                    fields={ASSIGNMENT_FIELDS}
                    initial={{
                      title: a.title,
                      description: a.description,
                      instructions: a.instructions ?? "",
                      requirements: a.requirements ?? "",
                      deadline: a.deadline?.toISOString() ?? "",
                      maxScore: a.maxScore,
                      allowedTypes: parseAllowed(a.allowedTypes),
                      maxFileSizeMb: a.maxFileSizeMb,
                      maxAttempts: a.maxAttempts,
                      latePolicy: a.latePolicy,
                    }}
                    submitLabel="Save assignment"
                  />
                </div>
              </details>
            </Card>
          ))}
        </div>

        <Card className="mt-4 p-6">
          <p className="text-xs font-semibold text-text-muted">New assignment</p>
          <div className="mt-3">
            <EditorForm
              endpoint={`/api/admin/modules/${mod.id}/assignments`}
              fields={ASSIGNMENT_FIELDS}
              initial={{ maxScore: 100, allowedTypes: ["PDF", "TEXT"], maxFileSizeMb: 10, maxAttempts: 3, latePolicy: "ALLOW" }}
              submitLabel="Create assignment"
            />
          </div>
        </Card>
      </section>
    </div>
  );
}
