import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { lessonSchema } from "@/lib/validators/course";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const parsed = lessonSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the lesson details." }, { status: 400 });

  const mod = await db.module.findUnique({ where: { id }, select: { id: true } });
  if (!mod) return NextResponse.json({ error: "Module not found." }, { status: 404 });

  const maxOrder = await db.lesson.aggregate({ where: { moduleId: id }, _max: { order: true } });
  const lesson = await db.lesson.create({
    data: {
      moduleId: id,
      title: parsed.data.title,
      content: parsed.data.content || null,
      youtubeVideoId: parsed.data.youtubeVideoId || null,
      durationMin: parsed.data.durationMin ?? null,
      order: (maxOrder._max.order ?? 0) + 1,
    },
  });
  await auditLog({ actorId: staff.id, action: "LESSON_CREATED", targetType: "Lesson", targetId: lesson.id });
  return NextResponse.json({ ok: true, id: lesson.id });
}
