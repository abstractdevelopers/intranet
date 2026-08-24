import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { moduleSchema } from "@/lib/validators/course";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const parsed = moduleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the module details." }, { status: 400 });

  const course = await db.course.findUnique({ where: { id }, select: { id: true } });
  if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });

  const maxOrder = await db.module.aggregate({ where: { courseId: id }, _max: { order: true } });
  const mod = await db.module.create({
    data: {
      courseId: id,
      ...parsed.data,
      releaseAt: parsed.data.releaseAt ? new Date(parsed.data.releaseAt) : null,
      order: (maxOrder._max.order ?? 0) + 1,
    },
  });
  await auditLog({ actorId: staff.id, action: "MODULE_CREATED", targetType: "Module", targetId: mod.id });
  return NextResponse.json({ ok: true, id: mod.id });
}
