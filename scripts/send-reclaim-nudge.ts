/**
 * Send the "four clicks away" reclaim nudge to students who have still not
 * signed up.
 *
 * Audience is the NOT_SIGNED_UP filter from campaign-sender.ts: active student
 * accounts with no username, no completed onboarding, no application and no
 * enrolment. Those are the rebuilt accounts that never came back.
 *
 * Excludes:
 *   - hard bounces (prisma/data/reclaim-no-email.txt)
 *   - anyone who opted out (User.emailOptOutAt) — this is bulk mail
 *   - anyone already sent this nudge (User.reclaimNudgeEmailSentAt)
 *
 * Usage (dry run by default — prints the count and sends nothing):
 *   npx tsx scripts/send-reclaim-nudge.ts
 *   npx tsx scripts/send-reclaim-nudge.ts --apply
 *   npx tsx scripts/send-reclaim-nudge.ts --apply --limit=25
 *   npx tsx scripts/send-reclaim-nudge.ts --test --to=me@example.com
 *
 * Progress lives in User.reclaimNudgeEmailSentAt, stamped BEFORE each send, so
 * a crash can skip someone but a retry can never email anyone twice. --test
 * does not stamp, so a later bulk run still reaches that address.
 */
import { PrismaClient } from "@prisma/client";
import { reclaimPressureEmail } from "../src/lib/email-templates";
import { WELCOME_TOKEN_TTL_MS } from "../src/lib/welcome";
import { readFileSync, existsSync } from "fs";
import crypto from "crypto";

const db = new PrismaClient();

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const TEST = args.includes("--test");
const LIMIT = Number.parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "25", 10);
const ONLY = args.find((a) => a.startsWith("--to="))?.slice("--to=".length) ?? null;
const noEmailArg = args.find((a) => a.startsWith("--no-email="));
const NO_EMAIL_PATH = noEmailArg?.slice("--no-email=".length) ?? "prisma/data/reclaim-no-email.txt";

/** Addresses suppressed from the send (hard bounces, provider test inbox). */
function loadNoEmail(path: string) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l.includes("@"));
}

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://intranet.launchverse.site").replace(/\/$/, "");
const API_KEY = process.env.SENDBYTE_API_KEY;
const FROM = process.env.EMAIL_FROM ?? "UCA Sandbox <no-reply@launchverse.site>";
const API = "https://api.sendbyte.africa/v1/emails";

async function sendOne(to: string, link: string) {
  const { subject, html, text } = reclaimPressureEmail({ email: to, link });
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, text, html }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
}

/** Mint a reset token directly, so this script doesn't import request-scoped auth. */
async function mintToken(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  await db.emailToken.create({
    data: {
      userId,
      token,
      type: "PASSWORD_RESET",
      expiresAt: new Date(Date.now() + WELCOME_TOKEN_TTL_MS),
    },
  });
  return token;
}

async function main() {
  if (!API_KEY) throw new Error("SENDBYTE_API_KEY is not set");

  const where = TEST && ONLY
    ? // A test send targets one chosen inbox purely to check rendering and
      // deliverability, so it deliberately ignores the audience filters —
      // otherwise testing against a signed-up address returns nothing.
      { email: ONLY }
    : {
        role: "STUDENT",
        status: "ACTIVE",
        // NOT_SIGNED_UP, mirrored from campaign-sender.ts.
        username: null,
        onboardingCompletedAt: null,
        applications: { none: {} },
        enrollments: { none: {} },
        // Bulk mail honours the opt-out; never override this.
        emailOptOutAt: null,
        ...(TEST ? {} : { reclaimNudgeEmailSentAt: null }),
        ...(ONLY ? { email: ONLY } : { email: { notIn: loadNoEmail(NO_EMAIL_PATH) } }),
      };

  const total = await db.user.count({ where });
  const batch = await db.user.findMany({
    where,
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
    take: TEST ? 1 : LIMIT,
  });

  console.log(`${total} not-signed-up account(s) awaiting the nudge; sending to ${batch.length} now.`);
  if (!APPLY && !TEST) {
    console.log("Dry run — nothing sent. Re-run with --apply.");
    return;
  }

  // Stamp first so an interruption can never cause a duplicate send.
  if (!TEST) {
    await db.user.updateMany({
      where: { id: { in: batch.map((u) => u.id) } },
      data: { reclaimNudgeEmailSentAt: new Date() },
    });
  }

  let sent = 0;
  const failures: string[] = [];
  for (const user of batch) {
    try {
      const token = await mintToken(user.id);
      await sendOne(user.email, `${APP_URL}/reset-password?token=${token}`);
      sent++;
      console.log(`  ✓ ${user.email}`);
    } catch (err) {
      failures.push(`${user.email}: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`  ✗ ${user.email}`);
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  const remaining = await db.user.count({ where });
  console.log(`\nSent ${sent}. Remaining in queue: ${remaining - sent}.`);
  if (failures.length) {
    console.log(`\n${failures.length} failure(s):`);
    failures.forEach((f) => console.log("  " + f));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
