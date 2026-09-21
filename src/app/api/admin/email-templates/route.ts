import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  kind: z.string().trim().max(40).optional(),
  eyebrow: z.string().trim().max(80).nullable().optional(),
  heading: z.string().trim().min(2).max(160),
  body: z.string().trim().min(1).max(20_000),
  ctaLabel: z.string().trim().max(80).nullable().optional(),
  ctaUrl: z.string().trim().url().max(500).nullable().optional(),
  note: z.string().trim().max(600).nullable().optional(),
  signoff: z.string().trim().max(200).nullable().optional(),
  imageIds: z.array(z.string().trim().min(1)).max(4).optional(),
});

/** Saved, reusable campaign templates. */
export async function GET() {
  await requireStaff();
  const templates = await db.emailTemplate.findMany({
    where: { isArchived: false },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ templates });
}

/** Save the current composer content as a reusable template. */
export async function POST(request: Request) {
  const staff = await requireStaff();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const data = parsed.data;

  const template = await db.emailTemplate.create({
    data: {
      name: data.name,
      kind: data.kind ?? "CUSTOM",
      eyebrow: data.eyebrow ?? null,
      heading: data.heading,
      body: data.body,
      ctaLabel: data.ctaLabel ?? null,
      ctaUrl: data.ctaUrl ?? null,
      note: data.note ?? null,
      signoff: data.signoff ?? null,
      imageIds: data.imageIds?.length ? JSON.stringify(data.imageIds) : null,
      createdById: staff.id,
    },
    select: { id: true },
  });

  await auditLog({
    actorId: staff.id,
    action: "EMAIL_TEMPLATE_CREATED",
    targetType: "EmailTemplate",
    targetId: template.id,
    metadata: { name: data.name },
  });

  return NextResponse.json({ ok: true, id: template.id });
}