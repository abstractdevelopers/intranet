import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/rbac";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "documents");

/**
 * Protected document delivery. Files are never at public URLs:
 * every request is authorized through user → enrollment → course → lesson → document.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;

  const doc = await db.document.findUnique({
    where: { id },
    include: {
      resources: { include: { lesson: { include: { module: { select: { courseId: true } } } } } },
      submissionFiles: { include: { submission: { select: { userId: true } } } },
    },
  });
  if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let allowed = isStaff(user.role);
  if (!allowed) {
    const courseIds = doc.resources.map((r) => r.lesson.module.courseId);
    if (courseIds.length > 0) {
      const enrollment = await db.enrollment.findFirst({
        where: { userId: user.id, status: "ACCEPTED", courseId: { in: courseIds } },
        select: { id: true },
      });
      allowed = Boolean(enrollment);
    }
  }
  if (!allowed) allowed = doc.submissionFiles.some((f) => f.submission.userId === user.id);
  if (!allowed)
    return NextResponse.json({ error: "You don't have access to this document." }, { status: 403 });

  // Containment: never serve outside the storage root.
  const fullPath = path.join(STORAGE_ROOT, doc.storagePath);
  if (!fullPath.startsWith(STORAGE_ROOT + path.sep)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const data = await readFile(fullPath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.title)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
