import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PdfReader, type ReaderNeighbour } from "@/components/pdf-reader";

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

  const lesson = doc.resources[0]?.lesson;

  // Server-side access check: enrolled + accepted in a course that uses this document.
  const courseIds = doc.resources.map((r) => r.lesson.module.course.id);

  // The access check and the sibling lookup are independent, so they share one
  // round trip. Siblings are the lesson's other PDFs in the order the lesson page
  // lists them, letting the reader continue to the next document at the end.
  const [access, siblings] = await Promise.all([
    db.enrollment.findFirst({
      where: { userId: user.id, status: "ACCEPTED", courseId: { in: courseIds } },
      select: { id: true },
    }),
    lesson
      ? db.lessonResource.findMany({
          where: { lessonId: lesson.id, type: "PDF", documentId: { not: null } },
          orderBy: { title: "asc" },
          select: { documentId: true, title: true },
        })
      : Promise.resolve([] as { documentId: string | null; title: string }[]),
  ]);
  if (!access) notFound();

  let prev: ReaderNeighbour | null = null;
  let next: ReaderNeighbour | null = null;
  const idx = siblings.findIndex((s) => s.documentId === doc.id);
  if (idx > -1) {
    const before = siblings[idx - 1];
    const after = siblings[idx + 1];
    if (before?.documentId) prev = { href: `/student/documents/${before.documentId}`, title: before.title };
    if (after?.documentId) next = { href: `/student/documents/${after.documentId}`, title: after.title };
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
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

      <PdfReader documentId={doc.id} title={doc.title} prev={prev} next={next} />
      <p className="text-center text-xs text-text-muted">
        Documents are read inside UCA Sandbox and can&apos;t be downloaded. Swipe left or right to
        turn the page.
      </p>
    </div>
  );
}
