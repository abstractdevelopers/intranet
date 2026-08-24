import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PdfReader } from "@/components/pdf-reader";

export const metadata = { title: "Document" };

/** In-app document reader — students read course PDFs without leaving UCA Sandbox. */
export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  const { id } = await params;

  const doc = await db.document.findUnique({
    where: { id },
    include: {
      resources: {
        include: { lesson: { include: { module: { include: { course: { select: { id: true, name: true } } } } } } },
        take: 1,
      },
    },
  });
  if (!doc || doc.mimeType !== "application/pdf") notFound();

  // Server-side access check: enrolled + accepted in a course that uses this document.
  const courseIds = doc.resources.map((r) => r.lesson.module.course.id);
  const access = await db.enrollment.findFirst({
    where: { userId: user.id, status: "ACCEPTED", courseId: { in: courseIds } },
    select: { id: true },
  });
  if (!access) notFound();

  const lesson = doc.resources[0]?.lesson;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <nav className="text-xs text-text-muted">
        {lesson ? (
          <>
            <Link href={`/student/courses/${lesson.module.course.id}`} className="hover:text-brand-1">
              {lesson.module.course.name}
            </Link>
            <span className="mx-2">/</span>
            <Link
              href={`/student/courses/${lesson.module.course.id}/modules/${lesson.module.id}/lessons/${lesson.id}`}
              className="hover:text-brand-1"
            >
              {lesson.title}
            </Link>
            <span className="mx-2">/</span>
            <span className="text-text">Document</span>
          </>
        ) : (
          <span className="text-text">Document</span>
        )}
      </nav>

      <PdfReader documentId={doc.id} title={doc.title} />
      <p className="text-center text-xs text-text-muted">
        Documents are read inside UCA Sandbox and can&apos;t be downloaded.
      </p>
    </div>
  );
}
