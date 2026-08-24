import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { courseSchema } from "@/lib/validators/course";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const parsed = courseSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the course details." }, { status: 400 });

  if (parsed.data.slug) {
    const clash = await db.course.findFirst({ where: { slug: parsed.data.slug, id: { not: id } } });
    if (clash) return NextResponse.json({ error: "That slug is already in use." }, { status: 400 });
  }

  const course = await db.course.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(parsed.data.type ? { isCompulsory: parsed.data.type === "COMPULSORY" } : {}),
    },
  });
  await auditLog({ actorId: staff.id, action: "COURSE_UPDATED", targetType: "Course", targetId: id });
  return NextResponse.json({ ok: true, id: course.id });
}
