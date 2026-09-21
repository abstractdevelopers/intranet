import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { runCampaign, materialiseRecipients, INTERACTIVE_BUDGET_MS } from "@/lib/campaign-sender";

const schema = z.object({
  action: z.enum(["SEND_NOW", "SCHEDULE", "CANCEL", "RETRY_FAILED", "DRAIN"]),
  scheduledAt: z.string().datetime().optional(),
});

/** Campaign status + live delivery counters for the detail view. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;

  const campaign = await db.emailCampaign.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      subject: true,
      status: true,
      audience: true,
      audienceSize: true,
      scheduledAt: true,
      startedAt: true,
      completedAt: true,
    },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  const [sent, failed, pending, sending] = await Promise.all([
    db.emailCampaignRecipient.count({ where: { campaignId: id, status: "SENT" } }),
    db.emailCampaignRecipient.count({ where: { campaignId: id, status: "FAILED" } }),
    db.emailCampaignRecipient.count({ where: { campaignId: id, status: "PENDING" } }),
    db.emailCampaignRecipient.count({ where: { campaignId: id, status: "SENDING" } }),
  ]);

  return NextResponse.json({ campaign, progress: { sent, failed, pending, sending } });
}

/**
 * Drive a campaign: send immediately, schedule it, cancel it, or retry the
 * rows that failed on a previous run.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const campaign = await db.emailCampaign.findUnique({
    where: { id },
    select: { id: true, status: true, title: true },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  if (parsed.data.action === "CANCEL") {
    if (campaign.status === "SENT") {
      return NextResponse.json({ error: "This campaign has already been sent." }, { status: 400 });
    }
    await db.emailCampaign.update({
      where: { id },
      data: { status: "CANCELED", completedAt: new Date() },
    });
    await auditLog({ actorId: staff.id, action: "CAMPAIGN_CANCELED", targetType: "EmailCampaign", targetId: id });
    return NextResponse.json({ ok: true, status: "CANCELED" });
  }

  if (parsed.data.action === "SCHEDULE") {
    if (!parsed.data.scheduledAt) {
      return NextResponse.json({ error: "A scheduled time is required." }, { status: 400 });
    }
    const when = new Date(parsed.data.scheduledAt);
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: "That date isn't valid." }, { status: 400 });
    }
    // Freeze the audience at scheduling time so the preview number is honest.
    await materialiseRecipients(id);
    await db.emailCampaign.update({
      where: { id },
      data: { status: "SCHEDULED", scheduledAt: when },
    });
    await auditLog({
      actorId: staff.id,
      action: "CAMPAIGN_SCHEDULED",
      targetType: "EmailCampaign",
      targetId: id,
      metadata: { scheduledAt: when.toISOString() },
    });
    return NextResponse.json({ ok: true, status: "SCHEDULED" });
  }

  if (parsed.data.action === "RETRY_FAILED") {
    // Re-open only rows that failed on a previous run. Rows left SENDING (a
    // crashed worker) stay closed, so a retry can never double-send.
    const reopened = await db.emailCampaignRecipient.updateMany({
      where: { campaignId: id, status: "FAILED" },
      data: { status: "PENDING", error: null },
    });
    const progress = await runCampaign(id, INTERACTIVE_BUDGET_MS);
    return NextResponse.json({ ok: true, reopened: reopened.count, progress });
  }

  // DRAIN: keep sending a campaign that is already mid-flight. The admin UI
  // calls this in a loop after "Send now" so a send completes in the browser
  // instead of waiting for the daily cron to finish it.
  if (parsed.data.action === "DRAIN") {
    if (!["SENDING", "SCHEDULED", "DRAFT"].includes(campaign.status)) {
      return NextResponse.json({ ok: true, progress: null, idle: true });
    }
    const progress = await runCampaign(id, INTERACTIVE_BUDGET_MS);
    return NextResponse.json({ ok: true, progress });
  }

  // SEND_NOW: only from a pre-send state, so a click can't re-drive a live run.
  if (!["DRAFT", "SCHEDULED", "FAILED"].includes(campaign.status)) {
    return NextResponse.json(
      { error: "This campaign is already being sent." },
      { status: 400 }
    );
  }
  await materialiseRecipients(id);
  const progress = await runCampaign(id, INTERACTIVE_BUDGET_MS);
  await auditLog({ actorId: staff.id, action: "CAMPAIGN_SENT", targetType: "EmailCampaign", targetId: id });
  return NextResponse.json({ ok: true, progress });
}

/** Delete a campaign. Recipient rows cascade; deliveries already made stand. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;

  const campaign = await db.emailCampaign.findUnique({ where: { id }, select: { title: true } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  await db.emailCampaign.delete({ where: { id } });
  await auditLog({
    actorId: staff.id,
    action: "CAMPAIGN_DELETED",
    targetType: "EmailCampaign",
    targetId: id,
    metadata: { title: campaign.title },
  });
  return NextResponse.json({ ok: true });
}