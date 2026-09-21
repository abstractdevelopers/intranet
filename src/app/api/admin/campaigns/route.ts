import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { parseAudience, resolveAudience, describeAudience } from "@/lib/campaign-sender";

const schema = z.object({
  title: z.string().trim().min(2).max(140),
  subject: z.string().trim().min(2).max(200),
  eyebrow: z.string().trim().max(80).nullable().optional(),
  heading: z.string().trim().min(2).max(160),
  body: z.string().trim().min(1).max(20_000),
  ctaLabel: z.string().trim().max(80).nullable().optional(),
  ctaUrl: z.string().trim().url().max(500).nullable().optional(),
  note: z.string().trim().max(600).nullable().optional(),
  signoff: z.string().trim().max(200).nullable().optional(),
  templateId: z.string().trim().nullable().optional(),
  imageIds: z.array(z.string().trim().min(1)).max(4).optional(),
  audience: z.enum(["ALL_STUDENTS", "SIGNED_UP", "NOT_SIGNED_UP", "COURSE", "PATHWAY"]),
  courseIds: z.array(z.string().trim().min(1)).max(20).optional(),
  pathway: z.string().trim().max(60).nullable().optional(),
});

/** List campaigns, newest first, with delivery counts for the dashboard. */
export async function GET() {
  await requireStaff();
  const campaigns = await db.emailCampaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      createdBy: { select: { email: true } },
      _count: { select: { recipients: true } },
    },
  });
  return NextResponse.json({
    campaigns: campaigns.map((c) => ({
      id: c.id,
      title: c.title,
      subject: c.subject,
      status: c.status,
      audienceLabel: describeAudience(parseAudience(c.audience)),
      audienceSize: c.audienceSize,
      recipientCount: c._count.recipients,
      scheduledAt: c.scheduledAt,
      createdAt: c.createdAt,
      createdBy: c.createdBy.email,
    })),
  });
}

/** Create a campaign as a draft, or schedule it when `scheduledAt` is given. */
export async function POST(request: Request) {
  const staff = await requireStaff();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const data = parsed.data;

  const rules = {
    audience: data.audience,
    courseIds: data.courseIds ?? [],
    pathway: data.pathway ?? null,
  };

  // Resolve the audience now so the admin sees a real number before sending.
  const recipients = await resolveAudience(rules);

  const campaign = await db.emailCampaign.create({
    data: {
      title: data.title,
      subject: data.subject,
      eyebrow: data.eyebrow ?? null,
      heading: data.heading,
      body: data.body,
      ctaLabel: data.ctaLabel ?? null,
      ctaUrl: data.ctaUrl ?? null,
      note: data.note ?? null,
      signoff: data.signoff ?? null,
      templateId: data.templateId ?? null,
      imageIds: data.imageIds?.length ? JSON.stringify(data.imageIds) : null,
      audience: JSON.stringify(rules),
      audienceSize: recipients.length,
      status: "DRAFT",
      createdById: staff.id,
    },
    select: { id: true },
  });

  await auditLog({
    actorId: staff.id,
    action: "CAMPAIGN_CREATED",
    targetType: "EmailCampaign",
    targetId: campaign.id,
    metadata: { title: data.title, audience: rules, audienceSize: recipients.length },
  });

  return NextResponse.json({ ok: true, id: campaign.id, audienceSize: recipients.length });
}