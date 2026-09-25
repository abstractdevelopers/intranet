import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { resolveAudienceForPush, describeAudience, type AudienceRules } from "@/lib/campaign-sender";
import { sendPushToUsers } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const audienceEnum = z.enum([
  "ALL_STUDENTS",
  "SIGNED_UP",
  "SIGNED_UP_NO_COURSE",
  "ELECTIVE",
  "NOT_SIGNED_UP",
  "COURSE",
  "PATHWAY",
]);

const schema = z.object({
  mode: z.enum(["AUDIENCE", "SEND"]),
  title: z.string().trim().min(1).max(120).optional(),
  body: z.string().trim().min(1).max(400).optional(),
  url: z.string().trim().max(500).nullable().optional(),
  /** Also drop an in-app notification for each recipient. */
  alsoInApp: z.boolean().optional(),
  audience: audienceEnum,
  courseIds: z.array(z.string().trim().min(1)).max(20).optional(),
  pathway: z.string().trim().max(60).nullable().optional(),
});

/**
 * Admin push notifications. Two modes, mirroring the email composer:
 *   { mode: "AUDIENCE" } → how many subscribed students the rules reach
 *   { mode: "SEND" }     → fan the push out to that audience
 */
export async function POST(request: Request) {
  const staff = await requireStaff();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const data = parsed.data;
  const rules: AudienceRules = {
    audience: data.audience,
    courseIds: data.courseIds ?? [],
    pathway: data.pathway ?? null,
  };

  const recipients = await resolveAudienceForPush(rules);
  const userIds = recipients.map((r) => r.id);

  if (data.mode === "AUDIENCE") {
    // Report how many of the audience actually have a device subscribed, since
    // that is the number a push will really reach.
    const subscribed = await db.pushSubscription.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true },
      distinct: ["userId"],
    });
    return NextResponse.json({
      count: subscribed.length,
      audienceSize: userIds.length,
      label: describeAudience(rules),
    });
  }

  if (!data.title || !data.body) {
    return NextResponse.json({ error: "A title and message are required." }, { status: 400 });
  }

  const campaign = await db.pushCampaign.create({
    data: {
      title: data.title,
      body: data.body,
      url: data.url || null,
      audience: JSON.stringify(rules),
      audienceSize: userIds.length,
      status: "DRAFT",
      createdById: staff.id,
    },
    select: { id: true },
  });

  // In-app notifications are optional but recommended, so a student who has no
  // push subscription still sees the message when they next open the portal.
  if (data.alsoInApp) {
    await db.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: "ANNOUNCEMENT",
        title: data.title!,
        body: data.body!.slice(0, 300),
      })),
    });
  }

  const result = await sendPushToUsers(userIds, {
    title: data.title,
    body: data.body,
    url: data.url || "/student/notifications",
    tag: `push-campaign:${campaign.id}`,
  });

  await db.pushCampaign.update({
    where: { id: campaign.id },
    data: {
      status: result.skipped ? "FAILED" : "SENT",
      sentCount: result.sent,
      failedCount: result.failed,
      sentAt: new Date(),
    },
  });

  await auditLog({
    actorId: staff.id,
    action: "PUSH_CAMPAIGN_SENT",
    targetType: "PushCampaign",
    targetId: campaign.id,
    metadata: { audience: rules, audienceSize: userIds.length, ...result },
  });

  if (result.skipped) {
    return NextResponse.json(
      {
        error:
          "Push isn't configured on this deployment, so nothing was delivered. Set the VAPID keys to enable it.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    id: campaign.id,
    audienceSize: userIds.length,
    ...result,
  });
}

/** Recent push campaigns, newest first, for the admin push page. */
export async function GET() {
  await requireStaff();
  const campaigns = await db.pushCampaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      body: true,
      url: true,
      audience: true,
      audienceSize: true,
      status: true,
      sentCount: true,
      failedCount: true,
      sentAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({
    campaigns: campaigns.map((c) => ({
      ...c,
      audienceLabel: describeAudience(JSON.parse(c.audience) as AudienceRules),
    })),
  });
}
