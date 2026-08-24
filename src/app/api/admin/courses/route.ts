import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { courseSchema } from "@/lib/validators/course";

export async function POST(request: Request) {
  const staff = await requireStaff();
  const parsed = courseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the course details." }, { status: 400 });

  const existing = await db.course.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) return NextResponse.json({ error: "That slug is already in use." }, { status: 400 });

  const course = await db.course.create({
    data: {
      ...parsed.data,
      isCompulsory: parsed.data.type === "COMPULSORY",
    },
  });
  await auditLog({
    actorId: staff.id,
    action: "COURSE_CREATED",
    targetType: "Course",
    targetId: course.id,
    metadata: { name: course.name },
  });
  return NextResponse.json({ ok: true, id: course.id });
}
