import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";

const schema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  audience: z.enum(["ACADEMY", "COURSE"]),
  courseId: z.string().optional(),
});

export async function POST(request: Request) {
  const staff = await requireStaff();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the announcement details." }, { status: 400 });

  const { title, body, audience, courseId } = parsed.data;
  if (audience === "COURSE") {
    if (!courseId) return NextResponse.json({ error: "Choose a course." }, { status: 400 });
    const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true } });
    if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  const announcement = await db.announcement.create({
    data: { title, body, audience, courseId: audience === "COURSE" ? courseId : null, authorId: staff.id },
  });

  // Notify the right students in-app (email hooks can plug in here later).
  const recipients = await db.user.findMany({
    where: {
      role: "STUDENT",
      status: "ACTIVE",
      ...(audience === "COURSE"
        ? { enrollments: { some: { courseId: courseId!, status: "ACCEPTED" } } }
        : {}),
    },
    select: { id: true },
  });
  await db.notification.createMany({
    data: recipients.map((r) => ({
      userId: r.id,
      type: "ANNOUNCEMENT",
      title,
      body: body.slice(0, 300),
    })),
  });

  await auditLog({
    actorId: staff.id,
    action: "ANNOUNCEMENT_PUBLISHED",
    targetType: "Announcement",
    targetId: announcement.id,
    metadata: { audience, courseId: courseId ?? null, recipients: recipients.length },
  });

  return NextResponse.json({ ok: true, id: announcement.id });
}
