import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";

const PLATFORMS = ["WHATSAPP", "TELEGRAM", "DISCORD", "OTHER"] as const;

const schema = z.object({
  name: z.string().trim().min(2, "Give the community a name.").max(120),
  description: z.string().trim().max(400).optional(),
  platform: z.enum(PLATFORMS).default("WHATSAPP"),
  url: z.string().trim().url("Enter a valid invite link.").max(500),
  // Empty string = the general academy community every student belongs to.
  pathway: z.string().trim().max(60).nullable().optional(),
  order: z.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
});

/** Add a community link students will see (#15, #16). */
export async function POST(request: Request) {
  const staff = await requireStaff();

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { pathway, ...rest } = parsed.data;
  const community = await db.community.create({
    data: { ...rest, pathway: pathway || null },
  });

  await auditLog({
    actorId: staff.id,
    action: "COMMUNITY_CREATED",
    targetType: "Community",
    targetId: community.id,
    metadata: { name: community.name, pathway: community.pathway },
  });

  return NextResponse.json({ ok: true, id: community.id });
}