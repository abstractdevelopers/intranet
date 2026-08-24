import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { lessonSchema } from "@/lib/validators/course";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const parsed = lessonSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the lesson details." }, { status: 400 });

  await db.lesson.update({
    where: { id },
    data: {
      ...parsed.data,
      youtubeVideoId:
        parsed.data.youtubeVideoId === undefined ? undefined : parsed.data.youtubeVideoId || null,
      durationMin: parsed.data.durationMin === undefined ? undefined : parsed.data.durationMin,
    },
  });
  await auditLog({ actorId: staff.id, action: "LESSON_UPDATED", targetType: "Lesson", targetId: id });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  await db.lesson.delete({ where: { id } });
  await auditLog({ actorId: staff.id, action: "LESSON_DELETED", targetType: "Lesson", targetId: id });
  return NextResponse.json({ ok: true });
}
