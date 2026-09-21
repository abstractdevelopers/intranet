import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { sendCampaignEmail, unsubscribeUrlFor } from "@/lib/campaign-sender";
import { campaignHtml, campaignPlainText, UNSUBSCRIBE_TOKEN } from "@/lib/campaign-content";

const schema = z.object({ to: z.string().trim().email().max(200) });

/**
 * Send a one-off preview to a single address. Nothing is recorded against the
 * campaign, so a test never affects delivery counts or blocks the real send.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const campaign = await db.emailCampaign.findUnique({
    where: { id },
    select: {
      subject: true, eyebrow: true, heading: true, body: true,
      ctaLabel: true, ctaUrl: true, note: true, signoff: true, imageIds: true,
    },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  const html = (await campaignHtml(campaign)).replaceAll(
    UNSUBSCRIBE_TOKEN,
    await unsubscribeUrlFor(parsed.data.to)
  );
  const text = campaignPlainText(campaign);

  try {
    await sendCampaignEmail({ to: parsed.data.to, subject: `[TEST] ${campaign.subject}`, html, text });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "We couldn't send that test." },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, to: parsed.data.to });
}