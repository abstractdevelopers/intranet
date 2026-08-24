import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";

const eventSchema = z.object({
  title: z.string().min(1).max(200),
  date: z.string().datetime({ offset: true }),
  audience: z.enum(["ACADEMY", "COURSE"]).default("ACADEMY"),
  courseId: z.string().optional(),
});

export async function POST(request: Request) {
  const staff = await requireStaff();
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the event details." }, { status: 400 });

  const { title, date, audience, courseId } = parsed.data;
  if (audience === "COURSE") {
    if (!courseId) return NextResponse.json({ error: "Choose a course." }, { status: 400 });
    const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true } });
    if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  const event = await db.event.create({
    data: {
      title,
      date: new Date(date),
      audience,
      courseId: audience === "COURSE" ? courseId : null,
      createdBy: staff.id,
    },
  });
  await auditLog({ actorId: staff.id, action: "EVENT_CREATED", targetType: "Event", targetId: event.id });
  return NextResponse.json({ ok: true, id: event.id });
}
