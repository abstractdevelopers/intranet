import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";

const schema = z.object({
  /** Delete every notification of this type. Omit to target all types. */
  type: z.string().trim().max(60).optional(),
  /** Only delete notifications created before this ISO date. */
  before: z.string().datetime().optional(),
});

/** Paginated notification list for staff moderation. */
export async function GET(request: Request) {
  await requireStaff();
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "";
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const perPage = 50;

  const where = type ? { type } : {};
  const [notifications, total, types] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, type: true, title: true, body: true, readAt: true, createdAt: true,
        user: { select: { email: true } },
      },
    }),
    db.notification.count({ where }),
    db.notification.groupBy({ by: ["type"], _count: true, orderBy: { _count: { type: "desc" } } }),
  ]);

  return NextResponse.json({
    notifications,
    total,
    page,
    perPage,
    types: types.map((t) => ({ type: t.type, count: t._count })),
  });
}

/**
 * Bulk delete. Deliberately requires at least one filter (a type or a cut-off
 * date) so a stray request can't wipe the whole notification table.
 */
export async function DELETE(request: Request) {
  const staff = await requireStaff();
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { type, before } = parsed.data;

  if (!type && !before) {
    return NextResponse.json(
      { error: "Choose a notification type or a cut-off date before clearing." },
      { status: 400 }
    );
  }

  const result = await db.notification.deleteMany({
    where: {
      ...(type ? { type } : {}),
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
  });

  await auditLog({
    actorId: staff.id,
    action: "NOTIFICATIONS_DELETED",
    targetType: "Notification",
    metadata: { type: type ?? "ALL", before: before ?? null, deleted: result.count },
  });

  return NextResponse.json({ ok: true, deleted: result.count });
}