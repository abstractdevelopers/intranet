import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/rbac";
import { canViewCreator } from "@/lib/projects";

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
      projectAssets: {
        include: { project: { select: { userId: true, visibility: true } } },
      },
      profileAvatars: { select: { userId: true } },
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

  // Portfolio assets: the owner always, everyone else only while the project is
  // published and its creator is a discoverable student.
  if (!allowed && doc.projectAssets.length > 0) {
    const mine = doc.projectAssets.some((a) => a.project.userId === user.id);
    if (mine) {
      allowed = true;
    } else {
      const publicProjects = doc.projectAssets.filter((a) => a.project.visibility === "PUBLISHED");
      for (const asset of publicProjects) {
        if (await canViewCreator(user.id, asset.project.userId)) {
          allowed = true;
          break;
        }
      }
    }
  }

  // Profile pictures are visible to any signed-in member the viewer may discover.
  if (!allowed && doc.profileAvatars.length > 0) {
    if (doc.profileAvatars.some((p) => p.userId === user.id)) {
      allowed = true;
    } else {
      for (const avatar of doc.profileAvatars) {
        if (await canViewCreator(user.id, avatar.userId)) {
          allowed = true;
          break;
        }
      }
    }
  }

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
