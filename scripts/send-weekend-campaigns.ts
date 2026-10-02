/**
 * Send the two weekend campaigns: reclaim (not signed up) and setup (signed up).
 *
 * They go out as two separate campaigns, one per audience, and are drained
 * SEQUENTIALLY. The sender holds a single global lease, so running them in
 * parallel would just make each wait on the other while risking the same
 * overlap that stranded the reclaim campaign on 2026-09-30.
 *
 * Recipients are materialised once; a re-run resumes from rows still PENDING and
 * never re-emails a SENT row. Hard bounces and the provider test inbox are
 * excluded.
 *
 * Usage:
 *   npx tsx scripts/send-weekend-campaigns.ts                       (dry run)
 *   npx tsx scripts/send-weekend-campaigns.ts --test --to=me@x.com
 *   npx tsx scripts/send-weekend-campaigns.ts --apply
 *   npx tsx scripts/send-weekend-campaigns.ts --apply --only=RECLAIM
 */
import { PrismaClient } from "@prisma/client";
import {
  WEEKEND_RECLAIM,
  WEEKEND_SETUP,
  NOT_SIGNED_UP_WHERE,
  SIGNED_UP_WHERE,
  loadSuppressedEmails,
  type CampaignDraft,
} from "../src/lib/weekend-campaign";

const db = new PrismaClient();

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const TEST = args.includes("--test");
const TEST_TO = args.find((a) => a.startsWith("--to="))?.slice("--to=".length) ?? null;
const ONLY = args.find((a) => a.startsWith("--only="))?.slice("--only=".length)?.toUpperCase() ?? null;

const CAMPAIGNS: { draft: CampaignDraft; key: string }[] = [
  { draft: WEEKEND_RECLAIM, key: "RECLAIM" },
  { draft: WEEKEND_SETUP, key: "SETUP" },
];

async function audienceFor(draft: CampaignDraft, suppressed: Set<string>) {
  const where = draft.audience === "NOT_SIGNED_UP" ? NOT_SIGNED_UP_WHERE : SIGNED_UP_WHERE;
  const rows = await db.user.findMany({ where, select: { id: true, email: true }, orderBy: { createdAt: "asc" } });
  return rows.filter((u) => !suppressed.has(u.email.toLowerCase()));
}

async function main() {
  const suppressed = loadSuppressedEmails();

  if (TEST) {
    if (!TEST_TO) throw new Error("--test needs --to=you@example.com");
    const { sendCampaignEmail, unsubscribeUrlFor } = await import("../src/lib/campaign-sender");
    const { campaignHtml, campaignPlainText, UNSUBSCRIBE_TOKEN } = await import("../src/lib/campaign-content");

    for (const { draft, key } of CAMPAIGNS) {
      if (ONLY && ONLY !== key) continue;
      const like = {
        eyebrow: draft.eyebrow, heading: draft.heading, body: draft.body,
        ctaLabel: draft.ctaLabel, ctaUrl: draft.ctaUrl, note: draft.note,
        signoff: draft.signoff, imageIds: null, style: draft.style,
      };
      const html = await campaignHtml(like);
      const text = await campaignPlainText(like);
      const unsub = await unsubscribeUrlFor(TEST_TO);
      await sendCampaignEmail({
        to: TEST_TO,
        subject: `[${key}] ${draft.subject}`,
        html: html.replaceAll(UNSUBSCRIBE_TOKEN, unsub),
        text: `${text}\n\nUnsubscribe: ${unsub}`,
      });
      console.log(`Test sent (${key}) to ${TEST_TO}`);
    }
    console.log("\nNo campaign rows created.");
    return;
  }

  // Report both audiences up front so the blast radius is visible before --apply.
  for (const { draft, key } of CAMPAIGNS) {
    const a = await audienceFor(draft, suppressed);
    console.log(`${key.padEnd(8)} ${draft.audience.padEnd(14)} ${String(a.length).padStart(4)} recipients  | ${draft.style.padEnd(9)} | ${draft.subject}`);
  }

  if (!APPLY) {
    console.log("\nDry run — nothing created or sent. Re-run with --apply.");
    return;
  }

  const admin = await db.user.findFirst({ where: { role: "FOUNDER" }, select: { id: true } });
  if (!admin) throw new Error("No FOUNDER to attribute the campaigns to");

  const { runCampaign } = await import("../src/lib/campaign-sender");

  for (const { draft, key } of CAMPAIGNS) {
    if (ONLY && ONLY !== key) continue;
    const audience = await audienceFor(draft, suppressed);

    let campaign = await db.emailCampaign.findFirst({ where: { title: draft.title } });
    if (!campaign) {
      campaign = await db.emailCampaign.create({
        data: {
          title: draft.title, subject: draft.subject, eyebrow: draft.eyebrow,
          heading: draft.heading, body: draft.body, ctaLabel: draft.ctaLabel,
          ctaUrl: draft.ctaUrl, note: draft.note, signoff: draft.signoff,
          style: draft.style,
          audience: JSON.stringify({ audience: draft.audience, courseIds: [], pathway: null }),
          audienceSize: audience.length, status: "DRAFT", createdById: admin.id,
        },
      });
      await db.emailCampaignRecipient.createMany({
        data: audience.map((u) => ({ campaignId: campaign!.id, userId: u.id, email: u.email })),
        skipDuplicates: true,
      });
      console.log(`\n${key}: created ${campaign.id} with ${audience.length} recipients.`);
    } else {
      console.log(`\n${key}: resuming ${campaign.id}.`);
    }

    const pending = await db.emailCampaignRecipient.count({
      where: { campaignId: campaign.id, status: "PENDING" },
    });
    console.log(`${key}: PENDING ${pending}`);

    // Sequentially drain this campaign before starting the next.
    for (let round = 0; round < 300; round++) {
      const p = await runCampaign(campaign.id, 55_000);
      console.log(`${key} round ${round + 1}: sent=${p.sent} failed=${p.failed} remaining=${p.remaining} status=${p.status}`);
      if (p.remaining === 0) break;
    }
  }

  // Final report: totals per campaign, with any stuck rows called out.
  for (const { draft, key } of CAMPAIGNS) {
    if (ONLY && ONLY !== key) continue;
    const c = await db.emailCampaign.findFirst({ where: { title: draft.title }, select: { id: true, status: true } });
    if (!c) continue;
    const by = await db.emailCampaignRecipient.groupBy({ by: ["status"], where: { campaignId: c.id }, _count: { _all: true } });
    const line = by.map((b) => `${b.status}=${b._count._all}`).join(" ");
    console.log(`\nFINAL ${key} [${c.status}]: ${line}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
