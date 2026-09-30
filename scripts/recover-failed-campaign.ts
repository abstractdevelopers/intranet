/**
 * Recover recipients stranded by the SendByte 429 storm.
 *
 * Campaigns 446 and 447 ("Your first Sandbox lesson is live") were sent twice, 81
 * seconds apart, and both blew through the provider's 120/min ceiling. Result:
 * 213 people received it twice while 422 never received it at all.
 *
 * This sends the same content to exactly the people who never got it, once.
 * It deliberately:
 *   - excludes anyone already delivered by either campaign, so no third copy;
 *   - excludes email opt-outs (bulk mail must honour them);
 *   - excludes known hard bounces and provider-suppressed addresses, which would
 *     only consume rate budget and fail again.
 *
 * It creates a real campaign row so the send inherits the fixed sender's rate
 * limiting, single-flight lease, retry-on-429 and resumable PENDING rows — and
 * shows up in /admin/campaigns instead of being an invisible side-effect.
 *
 * Usage (dry run by default):
 *   npx tsx scripts/recover-failed-campaign.ts
 *   npx tsx scripts/recover-failed-campaign.ts --test --to=me@example.com
 *   npx tsx scripts/recover-failed-campaign.ts --apply
 *   npx tsx scripts/recover-failed-campaign.ts --apply --budget=45000
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";

const db = new PrismaClient();

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const TEST = args.includes("--test");
const TEST_TO = args.find((a) => a.startsWith("--to="))?.slice("--to=".length) ?? null;
/**
 * Optional short budget (ms) for a first real batch. Anything not sent simply
 * stays PENDING and is picked up by the next run — nothing is skipped or lost.
 */
const BUDGET = Number(args.find((a) => a.startsWith("--budget="))?.slice("--budget=".length) ?? 0);

/** The two duplicate campaigns that failed. Newest first. */
const SOURCE_CAMPAIGNS = [
  "cmuny1oa40007jw04rfj0wuhg", // 446 failed
  "cmunxzy6o0001jw04rhjo42ai", // 447 failed
];
const TEMPLATE_CAMPAIGN = SOURCE_CAMPAIGNS[0];

const RECOVERY_TITLE = "Recovery — Your first Sandbox lesson is live";

function loadSuppressed() {
  const path = "prisma/data/reclaim-no-email.txt";
  if (!existsSync(path)) return new Set<string>();
  return new Set(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim().toLowerCase())
      .filter((l) => l.includes("@"))
  );
}

/**
 * Everyone who failed in either campaign and was never delivered by either,
 * minus opt-outs, hard bounces and provider-suppressed addresses.
 */
async function resolveRecoveryAudience() {
  const suppressedFile = loadSuppressed();

  const rows = await db.$queryRawUnsafe<{ email: string; userId: string | null }[]>(`
    WITH candidates AS (
      SELECT DISTINCT lower(email) AS email
      FROM "EmailCampaignRecipient"
      WHERE "campaignId" IN ('${SOURCE_CAMPAIGNS.join("','")}') AND status = 'FAILED'
    ),
    delivered AS (
      SELECT DISTINCT lower(email) AS email
      FROM "EmailCampaignRecipient"
      WHERE "campaignId" IN ('${SOURCE_CAMPAIGNS.join("','")}') AND status = 'SENT'
    ),
    suppressed AS (
      SELECT DISTINCT lower(email) AS email
      FROM "EmailCampaignRecipient"
      WHERE "campaignId" IN ('${SOURCE_CAMPAIGNS.join("','")}')
        AND status = 'FAILED' AND error LIKE '422%'
    )
    SELECT c.email, u.id AS "userId"
    FROM candidates c
    LEFT JOIN "User" u ON lower(u.email) = c.email
    WHERE c.email NOT IN (SELECT email FROM delivered)
      AND c.email NOT IN (SELECT email FROM suppressed)
      AND (u.id IS NULL OR u."emailOptOutAt" IS NULL)
    ORDER BY c.email
  `);

  return rows.filter((r) => !suppressedFile.has(r.email));
}

async function main() {
  const audience = await resolveRecoveryAudience();
  console.log(`Recovery audience: ${audience.length} recipients who never received the email.`);

  if (audience.length === 0) {
    console.log("Nobody to send to.");
    return;
  }

  const template = await db.emailCampaign.findUnique({ where: { id: TEMPLATE_CAMPAIGN } });
  if (!template) throw new Error(`Template campaign ${TEMPLATE_CAMPAIGN} not found`);

  // Single-recipient render check. Uses the real sender path so the content and
  // unsubscribe link are exercised exactly as the bulk run will, but writes no
  // campaign rows — so it can never affect who gets the real send.
  if (TEST) {
    if (!TEST_TO) throw new Error("--test needs --to=you@example.com");
    const { sendCampaignEmail } = await import("../src/lib/campaign-sender");
    const { campaignHtml, campaignPlainText, UNSUBSCRIBE_TOKEN } = await import(
      "../src/lib/campaign-content"
    );
    const { unsubscribeUrlFor } = await import("../src/lib/campaign-sender");

    const baseHtml = await campaignHtml(template);
    const baseText = campaignPlainText(template);
    const unsubscribe = await unsubscribeUrlFor(TEST_TO);
    await sendCampaignEmail({
      to: TEST_TO,
      subject: template.subject,
      html: baseHtml.replaceAll(UNSUBSCRIBE_TOKEN, unsubscribe),
      text: `${baseText}\n\nUnsubscribe: ${unsubscribe}`,
    });
    console.log(`Test email sent to ${TEST_TO}. No campaign rows created.`);
    return;
  }

  if (!APPLY) {
    console.log("\nDry run — nothing created or sent.");
    console.log("Content would be cloned from:", template.subject);
    console.log("First 5:", audience.slice(0, 5).map((a) => a.email).join(", "));
    console.log("Re-run with --apply to create the campaign and send.");
    return;
  }

  // Reuse an existing recovery campaign on a re-run so progress resumes instead
  // of starting a second send.
  let campaign = await db.emailCampaign.findFirst({ where: { title: RECOVERY_TITLE } });
  if (!campaign) {
    campaign = await db.emailCampaign.create({
      data: {
        title: RECOVERY_TITLE,
        subject: template.subject,
        eyebrow: template.eyebrow,
        heading: template.heading,
        body: template.body,
        ctaLabel: template.ctaLabel,
        ctaUrl: template.ctaUrl,
        note: template.note,
        signoff: template.signoff,
        imageIds: template.imageIds,
        style: template.style,
        audience: JSON.stringify({ audience: "ALL_STUDENTS", courseIds: [], pathway: null }),
        audienceSize: audience.length,
        status: "DRAFT",
        createdById: template.createdById,
      },
    });
    await db.emailCampaignRecipient.createMany({
      data: audience.map((a) => ({ campaignId: campaign!.id, userId: a.userId, email: a.email })),
      skipDuplicates: true,
    });
    console.log("Created recovery campaign", campaign.id);
  } else {
    console.log("Resuming existing recovery campaign", campaign.id);
  }

  const { runCampaign } = await import("../src/lib/campaign-sender");

  const pendingBefore = await db.emailCampaignRecipient.count({
    where: { campaignId: campaign.id, status: "PENDING" },
  });
  console.log(`PENDING before this run: ${pendingBefore}`);

  // Loop until the queue drains. Not on Vercel here, so a long budget is fine.
  const perRunBudget = BUDGET > 0 ? BUDGET : 240_000;
  if (BUDGET > 0) console.log(`Per-run budget: ${perRunBudget}ms (remainder stays PENDING).`);

  for (let round = 0; round < 200; round++) {
    const progress = await runCampaign(campaign.id, perRunBudget);
    console.log(
      `round ${round + 1}: sent=${progress.sent} failed=${progress.failed} remaining=${progress.remaining} status=${progress.status}`
    );
    if (progress.remaining === 0) break;
    // A short budget is only meant for a controlled first batch.
    if (BUDGET > 0) break;
  }

  const [sent, failed, pending] = await Promise.all([
    db.emailCampaignRecipient.count({ where: { campaignId: campaign.id, status: "SENT" } }),
    db.emailCampaignRecipient.count({ where: { campaignId: campaign.id, status: "FAILED" } }),
    db.emailCampaignRecipient.count({ where: { campaignId: campaign.id, status: "PENDING" } }),
  ]);
  console.log(`\nFINAL — sent: ${sent} | failed: ${failed} | pending: ${pending}`);

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
