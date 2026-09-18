import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";

const PLATFORMS = ["WHATSAPP", "TELEGRAM", "DISCORD", "OTHER"] as const;

const schema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(400).nullable().optional(),
  platform: z.enum(PLATFORMS).optional(),
  url: z.string().trim().url().max(500).optional(),
  pathway: z.string().trim().max(60).nullable().optional(),
  order: z.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
});

/** Update or remove a community link (#15, #16). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await db.community.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Community not found." }, { status: 404 });

  const { pathway, ...rest } = parsed.data;
  await db.community.update({
    where: { id },
    data: { ...rest, ...(pathway === undefined ? {} : { pathway: pathway || null }) },
  });

  await auditLog({
    actorId: staff.id,
    action: "COMMUNITY_UPDATED",
    targetType: "Community",
    targetId: id,
    metadata: parsed.data,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;

  const existing = await db.community.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!existing) return NextResponse.json({ error: "Community not found." }, { status: 404 });

  await db.community.delete({ where: { id } });
  await auditLog({
    actorId: staff.id,
    action: "COMMUNITY_DELETED",
    targetType: "Community",
    targetId: id,
    metadata: { name: existing.name },
  });

  return NextResponse.json({ ok: true });
}