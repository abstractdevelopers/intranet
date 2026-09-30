/**
 * Send the approved reclaim campaign to students who signed up but never started.
 *
 * Creates a real campaign row, so the send inherits the fixed sender's shared
 * rate limiting, single-flight lease, retry-on-429 and resumable PENDING rows —
 * and is visible in /admin/campaigns. Recipients are materialised once; a re-run
 * resumes from the rows still PENDING and never re-emails a SENT row.
 *
 * Hard bounces and the provider test inbox are excluded: they would fail again
 * and consume rate budget. Their accounts still exist, so those people can still
 * use "forgot password".
 *
 * Usage:
 *   npx tsx scripts/send-reclaim-campaign.ts              (dry run: count only)
 *   npx tsx scripts/send-reclaim-campaign.ts --test --to=me@example.com
 *   npx tsx scripts/send-reclaim-campaign.ts --apply --budget=60000   (first batch)
 *   npx tsx scripts/send-reclaim-campaign.ts --apply                  (drain the rest)
 */
import { PrismaClient } from "@prisma/client";
import {
  RECLAIM_CAMPAIGN,
  NOT_SIGNED_UP_WHERE,
  loadSuppressedEmails,
} from "../src/lib/reclaim-campaign";

const db = new PrismaClient();

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const TEST = args.includes("--test");
const TEST_TO = args.find((a) => a.startsWith("--to="))?.slice("--to=".length) ?? null;
const BUDGET = Number(args.find((a) => a.startsWith("--budget="))?.slice("--budget=".length) ?? 0);

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://intranet.launchverse.site").replace(/\/$/, "");
const CTA_URL = `${APP_URL}/forgot-password`;

async function main() {
  const suppressed = loadSuppressedEmails();
  const candidates = await db.user.findMany({
    where: NOT_SIGNED_UP_WHERE,
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });
  const audience = candidates.filter((u) => !suppressed.has(u.email.toLowerCase()));

  console.log(`Candidates        : ${candidates.length}`);
  console.log(`Excluded (bounce) : ${candidates.length - audience.length}`);
  console.log(`Will send to      : ${audience.length}`);
  console.log(`Style             : ${RECLAIM_CAMPAIGN.style}`);
  console.log(`CTA               : ${CTA_URL}`);

  if (TEST) {
    if (!TEST_TO) throw new Error("--test needs --to=you@example.com");
    const { sendCampaignEmail, unsubscribeUrlFor } = await import("../src/lib/campaign-sender");
    const { campaignHtml, campaignPlainText, UNSUBSCRIBE_TOKEN } = await import(
      "../src/lib/campaign-content"
    );
    const campaignLike = {
      eyebrow: RECLAIM_CAMPAIGN.eyebrow,
      heading: RECLAIM_CAMPAIGN.heading,
      body: RECLAIM_CAMPAIGN.body,
      ctaLabel: RECLAIM_CAMPAIGN.ctaLabel,
      ctaUrl: CTA_URL,
      note: RECLAIM_CAMPAIGN.note,
      signoff: RECLAIM_CAMPAIGN.signoff,
      imageIds: null,
      style: RECLAIM_CAMPAIGN.style,
    };
    const baseHtml = await campaignHtml(campaignLike);
    const baseText = campaignPlainText(campaignLike);
    const unsub = await unsubscribeUrlFor(TEST_TO);
    await sendCampaignEmail({
      to: TEST_TO,
      subject: RECLAIM_CAMPAIGN.subject,
      html: baseHtml.replaceAll(UNSUBSCRIBE_TOKEN, unsub),
      text: `${baseText}\n\nUnsubscribe: ${unsub}`,
    });
    console.log(`\nTest sent to ${TEST_TO}. No campaign rows created.`);
    return;
  }

  if (!APPLY) {
    console.log("\nDry run — nothing created or sent. Re-run with --apply.");
    return;
  }

  // Reuse the row on a re-run so progress resumes rather than starting a second send.
  let campaign = await db.emailCampaign.findFirst({ where: { title: RECLAIM_CAMPAIGN.title } });
  if (!campaign) {
    const admin = await db.user.findFirst({ where: { role: "FOUNDER" }, select: { id: true } });
    if (!admin) throw new Error("No FOUNDER to attribute the campaign to");
    campaign = await db.emailCampaign.create({
      data: {
        title: RECLAIM_CAMPAIGN.title,
        subject: RECLAIM_CAMPAIGN.subject,
        eyebrow: RECLAIM_CAMPAIGN.eyebrow,
        heading: RECLAIM_CAMPAIGN.heading,
        body: RECLAIM_CAMPAIGN.body,
        ctaLabel: RECLAIM_CAMPAIGN.ctaLabel,
        ctaUrl: CTA_URL,
        note: RECLAIM_CAMPAIGN.note,
        signoff: RECLAIM_CAMPAIGN.signoff,
        style: RECLAIM_CAMPAIGN.style,
        audience: JSON.stringify({ audience: "NOT_SIGNED_UP", courseIds: [], pathway: null }),
        audienceSize: audience.length,
        status: "DRAFT",
        createdById: admin.id,
      },
    });
    await db.emailCampaignRecipient.createMany({
      data: audience.map((u) => ({ campaignId: campaign!.id, userId: u.id, email: u.email })),
      skipDuplicates: true,
    });
    console.log(`\nCreated campaign ${campaign.id} with ${audience.length} recipients.`);
  } else {
    console.log(`\nResuming campaign ${campaign.id}.`);
  }

  const { runCampaign } = await import("../src/lib/campaign-sender");
  const pending = await db.emailCampaignRecipient.count({
    where: { campaignId: campaign.id, status: "PENDING" },
  });
  console.log(`PENDING: ${pending}`);

  const perRun = BUDGET > 0 ? BUDGET : 240_000;
  for (let round = 0; round < 200; round++) {
    const p = await runCampaign(campaign.id, perRun);
    console.log(
      `round ${round + 1}: sent=${p.sent} failed=${p.failed} remaining=${p.remaining} status=${p.status}`
    );
    if (p.remaining === 0) break;
    if (BUDGET > 0) break;
  }

  const [sent, failed, left] = await Promise.all([
    db.emailCampaignRecipient.count({ where: { campaignId: campaign.id, status: "SENT" } }),
    db.emailCampaignRecipient.count({ where: { campaignId: campaign.id, status: "FAILED" } }),
    db.emailCampaignRecipient.count({ where: { campaignId: campaign.id, status: "PENDING" } }),
  ]);
  console.log(`\nFINAL — sent: ${sent} | failed: ${failed} | pending: ${left}`);

  if (failed > 0) {
    const reasons = await db.emailCampaignRecipient.groupBy({
      by: ["error"],
      where: { campaignId: campaign.id, status: "FAILED" },
      _count: { _all: true },
    });
    reasons.slice(0, 5).forEach((r) => console.log(`  x${r._count._all} ${(r.error ?? "").slice(0, 100)}`));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
