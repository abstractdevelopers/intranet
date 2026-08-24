import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "documents");
const MAX_RESOURCE_BYTES = 25 * 1024 * 1024;

/** Attach a resource to a lesson: either an external link or an uploaded PDF (protected storage). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;

  const lesson = await db.lesson.findUnique({ where: { id }, select: { id: true } });
  if (!lesson) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid resource." }, { status: 400 });

  const title = String(form.get("title") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  const file = form.get("file");
  if (!title) return NextResponse.json({ error: "Give the resource a title." }, { status: 400 });

  // Link resource
  if (url && !(file instanceof File && file.size > 0)) {
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "That link isn't valid." }, { status: 400 });
    }
    const resource = await db.lessonResource.create({
      data: { lessonId: id, title, type: "LINK", url },
    });
    return NextResponse.json({ ok: true, id: resource.id });
  }

  // PDF upload → protected storage, never a public path
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Attach a PDF or provide a link." }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF uploads are supported." }, { status: 400 });
  }
  if (file.size > MAX_RESOURCE_BYTES) {
    return NextResponse.json({ error: "Files must be 25MB or smaller." }, { status: 400 });
  }

  const storagePath = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await mkdir(STORAGE_ROOT, { recursive: true });
  await writeFile(path.join(STORAGE_ROOT, storagePath), Buffer.from(await file.arrayBuffer()));

  const resource = await db.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: { title: file.name, storagePath, mimeType: file.type, sizeBytes: file.size, uploadedById: staff.id },
    });
    return tx.lessonResource.create({
      data: { lessonId: id, title, type: "PDF", documentId: doc.id },
    });
  });

  await auditLog({ actorId: staff.id, action: "RESOURCE_ADDED", targetType: "Lesson", targetId: id });
  return NextResponse.json({ ok: true, id: resource.id });
}
