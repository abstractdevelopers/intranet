import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/rbac";
import { issueCertificateIfComplete } from "@/lib/certificates";

const schema = z.object({ action: z.enum(["OPEN", "COMPLETE"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  const { id } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  // Server-side content gate: enrolled + accepted, never trust the client.
  const access = await db.enrollment.findFirst({
    where: {
      userId: user.id,
      status: "ACCEPTED",
      course: { modules: { some: { lessons: { some: { id } } } } },
    },
    select: { id: true },
  });
  if (!access) return NextResponse.json({ error: "Not enrolled in this course." }, { status: 403 });

  const now = new Date();
  if (parsed.data.action === "OPEN") {
    await db.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId: id } },
      create: { userId: user.id, lessonId: id, openedAt: now },
      update: { lastActivityAt: now },
    });
  } else {
    await db.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId: id } },
      create: { userId: user.id, lessonId: id, openedAt: now, completedAt: now },
      update: { completedAt: now, lastActivityAt: now },
    });
    // A finished lesson may complete the course — issue the certificate if so.
    const lesson = await db.lesson.findUnique({
      where: { id },
      select: { module: { select: { courseId: true } } },
    });
    if (lesson) await issueCertificateIfComplete(user.id, lesson.module.courseId);
  }
  return NextResponse.json({ ok: true });
}
