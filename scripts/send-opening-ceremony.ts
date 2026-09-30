/**
 * Announce the live opening ceremony to every active student.
 *
 * Unlike the reclaim waves this needs no per-recipient token — the Google Meet
 * link is identical for everyone — so it sends with concurrency instead of one
 * at a time. That matters: the event is happening while this runs.
 *
 * Excludes hard bounces (prisma/data/reclaim-no-email.txt) and anyone who opted
 * out (User.emailOptOutAt) — this is bulk mail.
 *
 * Usage (dry run by default):
 *   npx tsx scripts/send-opening-ceremony.ts
 *   npx tsx scripts/send-opening-ceremony.ts --apply
 *   npx tsx scripts/send-opening-ceremony.ts --test --to=me@example.com
 *
 * Progress lives in User.openingCeremonyEmailSentAt, stamped BEFORE sending, so
 * a crash can skip someone but a retry can never email anyone twice.
 */
import { PrismaClient } from "@prisma/client";
import { openingCeremonyEmail } from "../src/lib/email-templates";
import { readFileSync, existsSync } from "fs";

const db = new PrismaClient();

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const TEST = args.includes("--test");
const ONLY = args.find((a) => a.startsWith("--to="))?.slice("--to=".length) ?? null;
const noEmailArg = args.find((a) => a.startsWith("--no-email="));
const NO_EMAIL_PATH = noEmailArg?.slice("--no-email=".length) ?? "prisma/data/reclaim-no-email.txt";
const LINK = args.find((a) => a.startsWith("--link="))?.slice("--link=".length) ?? "https://meet.google.com/rhq-ibop-wnm";

/** Addresses suppressed from the send (hard bounces, provider test inbox). */
function loadNoEmail(path: string) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l.includes("@"));
}

const API_KEY = process.env.SENDBYTE_API_KEY;
const FROM = process.env.EMAIL_FROM ?? "UCA Sandbox <no-reply@launchverse.site>";
const API = "https://api.sendbyte.africa/v1/emails";
const CONCURRENCY = 10;

async function sendOne(to: string) {
  const { subject, html, text } = openingCeremonyEmail({ link: LINK });
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, text, html }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
}

/** Run tasks with a fixed concurrency ceiling. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  if (!API_KEY) throw new Error("SENDBYTE_API_KEY is not set");

  const where = TEST && ONLY
    ? // A test send targets one chosen inbox purely to check rendering and
      // deliverability, so it ignores the audience filters.
      { email: ONLY }
    : {
        role: "STUDENT",
        status: "ACTIVE",
        // Bulk mail honours the opt-out; never override this.
        emailOptOutAt: null,
        ...(TEST ? {} : { openingCeremonyEmailSentAt: null }),
        ...(ONLY ? { email: ONLY } : { email: { notIn: loadNoEmail(NO_EMAIL_PATH) } }),
      };

  const batch = await db.user.findMany({
    where,
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
    take: TEST ? 1 : undefined,
  });

  console.log(`${batch.length} recipient(s) for the ceremony announcement.`);
  if (!APPLY && !TEST) {
    console.log("Dry run — nothing sent. Re-run with --apply.");
    return;
  }

  // Stamp first so an interruption can never cause a duplicate send.
  if (!TEST) {
    await db.user.updateMany({
      where: { id: { in: batch.map((u) => u.id) } },
      data: { openingCeremonyEmailSentAt: new Date() },
    });
  }

  let sent = 0;
  const failures: string[] = [];
  await mapLimit(batch, CONCURRENCY, async (user) => {
    try {
      await sendOne(user.email);
      sent++;
      if (sent % 50 === 0) console.log(`  … ${sent} sent`);
    } catch (err) {
      failures.push(`${user.email}: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`  ✗ ${user.email}`);
    }
  });

  console.log(`\nSent ${sent} of ${batch.length}.`);
  if (failures.length) {
    console.log(`\n${failures.length} failure(s):`);
    failures.slice(0, 20).forEach((f) => console.log("  " + f));
    if (failures.length > 20) console.log(`  … and ${failures.length - 20} more`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
