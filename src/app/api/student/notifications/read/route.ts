import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/rbac";

const schema = z.object({ id: z.string().optional() });

export async function POST(request: Request) {
  const user = await requireStudent();
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  await db.notification.updateMany({
    where: {
      userId: user.id,
      readAt: null,
      ...(parsed.data.id ? { id: parsed.data.id } : {}),
    },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
