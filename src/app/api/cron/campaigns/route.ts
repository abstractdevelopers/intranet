import { NextResponse } from "next/server";
import { runDueCampaigns, materialiseRecipients, parseAudience } from "@/lib/campaign-sender";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/**
 * Background sender. Vercel Cron calls this on a schedule; it picks up any
 * scheduled campaign whose time has passed, plus any send left incomplete, and
 * advances each by a few batches.
 *
 * Protected by CRON_SECRET (Vercel sends it as a bearer token). A signed-in
 * admin can also trigger it manually to force a run.
 */
async function authorize(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (secret && header === `Bearer ${secret}`) return true;

  // Fall back to a staff check so an admin can kick the queue from the UI.
  try {
    await requireStaff();
    return true;
  } catch {
    return false;
  }
}

/** Create recipient rows for campaigns that were scheduled before this deploy. */
async function backfillScheduled() {
  const scheduled = await db.emailCampaign.findMany({
    where: { status: "SCHEDULED", audienceSize: null },
    select: { id: true, audience: true },
    take: 5,
  });
  for (const campaign of scheduled) {
    const count = await db.emailCampaignRecipient.count({ where: { campaignId: campaign.id } });
    if (count === 0 && parseAudience(campaign.audience)) await materialiseRecipients(campaign.id);
  }
}

export async function GET(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  await backfillScheduled();
  const results = await runDueCampaigns(5);
  return NextResponse.json({ ok: true, ran: results.length, results });
}

export async function POST(request: Request) {
  return GET(request);
}