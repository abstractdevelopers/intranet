/**
 * Reconcile the reclaim campaign against the provider's delivery records.
 *
 * A lease bug (fixed in campaign-sender) let a cron run and a manual run overlap,
 * leaving 25 recipients claimed as SENDING with no outcome recorded. The provider
 * is the source of truth for what actually went out:
 *
 *   - 16 of those 25 WERE delivered, but our rows say SENDING. Left alone they
 *     would be resent on any retry, emailing those people twice.
 *   - 9 were never sent and must go out.
 *
 * This corrects the rows to match reality. It deletes nothing: delivered rows are
 * marked SENT, unsent rows are returned to PENDING so the normal sender picks
 * them up.
 *
 * Usage:
 *   npx tsx scripts/reconcile-reclaim-campaign.ts            (dry run)
 *   npx tsx scripts/reconcile-reclaim-campaign.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const APPLY = process.argv.slice(2).includes("--apply");

const CAMPAIGN_ID = "cmuoiu3i90001zd17a2if1gkm";
const SUBJECT = "You didn't quit. You got busy.";
const API_KEY = process.env.SENDBYTE_API_KEY;
if (!API_KEY) throw new Error("SENDBYTE_API_KEY is not set");

/** Every reclaim delivery the provider recorded, keyed by address. */
async function fetchProviderDeliveries(): Promise<Map<string, { status: string; at: string }>> {
  const out = new Map<string, { status: string; at: string }>();
  for (let offset = 0; offset < 3000; offset += 100) {
    const res = await fetch(`https://api.sendbyte.africa/v1/emails?limit=100&offset=${offset}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (!res.ok) throw new Error(`provider ${res.status}`);
    const json = (await res.json()) as { data?: { subject?: string; to?: string[]; status?: string; created_at?: string }[] };
    const rows = json.data ?? [];
    if (rows.length === 0) break;
    for (const r of rows) {
      if (r.subject !== SUBJECT) continue;
      for (const to of r.to ?? []) {
        out.set(String(to).toLowerCase(), { status: r.status ?? "unknown", at: r.created_at ?? new Date().toISOString() });
      }
    }
  }
  return out;
}

async function main() {
  const deliveries = await fetchProviderDeliveries();
  console.log(`Provider reclaim records: ${deliveries.size}`);

  const rows = await db.emailCampaignRecipient.findMany({
    where: { campaignId: CAMPAIGN_ID },
    select: { id: true, email: true, status: true },
  });

  const deliveredButStuck: { id: string; email: string; at: string }[] = [];
  const neverSent: { id: string; email: string }[] = [];

  for (const r of rows) {
    const p = deliveries.get(r.email.toLowerCase());
    if (r.status === "SENDING" || r.status === "PENDING") {
      if (p) deliveredButStuck.push({ id: r.id, email: r.email, at: p.at });
      else neverSent.push({ id: r.id, email: r.email });
    }
  }

  console.log();
  console.log("Delivered but marked SENDING/PENDING (would double-send):", deliveredButStuck.length);
  deliveredButStuck.forEach((d) => console.log("   ", d.email));
  console.log();
  console.log("Never sent (need delivery):", neverSent.length);
  neverSent.forEach((d) => console.log("   ", d.email));

  if (!APPLY) {
    console.log("\nDry run — nothing changed. Re-run with --apply.");
    return;
  }

  // Bulk writes, not one statement per row: DATABASE_URL goes through the
  // transaction pooler where each round trip is ~500ms, so 25 sequential
  // updates inside one transaction blows the default 5s transaction timeout.
  // Grouping by status keeps this to two statements.
  const deliveredIds = deliveredButStuck.map((d) => d.id);
  const neverIds = neverSent.map((n) => n.id);
  const earliest = deliveredButStuck.reduce(
    (min, d) => (d.at < min ? d.at : min),
    deliveredButStuck[0]?.at ?? new Date().toISOString()
  );

  await db.$transaction(
    async (tx) => {
      if (deliveredIds.length > 0) {
        await tx.emailCampaignRecipient.updateMany({
          where: { id: { in: deliveredIds } },
          data: { status: "SENT", sentAt: new Date(earliest), error: null },
        });
      }
      if (neverIds.length > 0) {
        await tx.emailCampaignRecipient.updateMany({
          where: { id: { in: neverIds } },
          data: { status: "PENDING", error: null },
        });
      }
    },
    { timeout: 30_000 }
  );

  console.log(`\nRepaired: ${deliveredButStuck.length} marked SENT, ${neverSent.length} returned to PENDING.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
