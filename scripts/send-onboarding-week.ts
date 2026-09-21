/**
 * Send the onboarding-week announcement.
 *
 * Two audiences, two copies — chosen automatically per recipient:
 *   unsigned → waiting-list accounts that never started onboarding
 *   signed   → accounts that have begun onboarding / applied / enrolled
 *
 * Usage (dry run by default — prints recipient counts and sends nothing):
 *   npx tsx scripts/send-onboarding-week.ts
 *   npx tsx scripts/send-onboarding-week.ts --apply --audience=unsigned
 *   npx tsx scripts/send-onboarding-week.ts --apply --audience=signed
 *   npx tsx scripts/send-onboarding-week.ts --apply --audience=all
 *   npx tsx scripts/send-onboarding-week.ts --apply --limit=50
 *   npx tsx scripts/send-onboarding-week.ts --apply --to=someone@example.com
 *
 * Progress is recorded on the User row for the audience being sent
 * (onboardingWeekEmailSentAt / onboardingWeekSignedUpEmailSentAt), so re-running
 * resumes rather than resending. That column is written BEFORE each send, so an
 * interrupted run can skip someone but can never email anyone twice.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { onboardingWeekEmail, onboardingWeekSignedUpEmail } from "../src/lib/email-templates";

const db = new PrismaClient();

type Audience = "unsigned" | "signed";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const RESEND = args.includes("--resend");
const audienceArg = args.find((a) => a.startsWith("--audience="))?.split("=")[1];
const AUDIENCE: Audience | "all" =
  audienceArg === "signed" || audienceArg === "unsigned" || audienceArg === "all" ? audienceArg : "unsigned";
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number.parseInt(limitArg.split("=")[1], 10) : 100;
const onlyArg = args.find((a) => a.startsWith("--to="));
const ONLY = onlyArg ? onlyArg.slice("--to=".length) : null;
/** Test mode: send to `--to` only, never stamp, so the bulk run still reaches them. */
const TEST = args.includes("--test");

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://intranet.launchverse.site").replace(/\/$/, "");
const API_KEY = process.env.SENDBYTE_API_KEY;
const FROM = process.env.EMAIL_FROM ?? "Unify Creator Academy <uca@launchverse.site>";
const API = "https://api.sendbyte.africa/v1/emails";

/**
 * Waiting-list accounts that have not begun onboarding: no username, no
 * onboarding, no application and no enrollment. An applicant passes through the
 * same state, so all four are checked at once — the moment someone applies or
 * onboards they leave this set automatically.
 */
const NOT_SIGNED_UP: Prisma.UserWhereInput = {
  role: "STUDENT",
  status: "ACTIVE",
  username: null,
  onboardingCompletedAt: null,
  applications: { none: {} },
  enrollments: { none: {} },
};

/** Everyone else holding a student account. */
const SIGNED_UP: Prisma.UserWhereInput = {
  role: "STUDENT",
  status: "ACTIVE",
  OR: [
    { username: { not: null } },
    { onboardingCompletedAt: { not: null } },
    { applications: { some: {} } },
    { enrollments: { some: {} } },
  ],
};

const AUDIENCES: Record<Audience, { label: string; where: Prisma.UserWhereInput; stamp: string }> = {
  unsigned: { label: "not signed up", where: NOT_SIGNED_UP, stamp: "onboardingWeekEmailSentAt" },
  signed: { label: "signed up", where: SIGNED_UP, stamp: "onboardingWeekSignedUpEmailSentAt" },
};

async function sendOne(to: string, audience: Audience) {
  const common = { email: to, loginUrl: `${APP_URL}/login`, forgotUrl: `${APP_URL}/forgot-password` };
  const { subject, html, text } =
    audience === "signed" ? onboardingWeekSignedUpEmail(common) : onboardingWeekEmail(common);
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, text, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${body.slice(0, 200)}`);
  }
}

/** Send one audience, returning a summary. */
async function sendAudience(audience: Audience) {
  const { label, where: base, stamp } = AUDIENCES[audience];
  const where: Prisma.UserWhereInput = {
    ...base,
    ...((RESEND ? {} : { [stamp]: null }) as Prisma.UserWhereInput),
    ...(ONLY ? { email: ONLY } : {}),
  };

  const everyone = await db.user.count({ where: base });
  const pendingBase = await db.user.count({
    where: { ...base, ...(ONLY ? { email: ONLY } : {}) },
  });
  const total = await db.user.count({ where });
  console.log(`\n[${label}]`);
  console.log(`  accounts        : ${everyone}`);
  console.log(`  already emailed : ${pendingBase - total}`);
  console.log(`  pending         : ${total}`);
  console.log(`  will send now   : ${Math.min(LIMIT, total)}`);

  if (!APPLY || total === 0) return;

  const batch = await db.user.findMany({
    where,
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
    take: LIMIT,
  });

  // Stamp first: never duplicate a send, even if this process dies mid-way.
  await db.user.updateMany({
    where: { id: { in: batch.map((u) => u.id) } },
    data: { [stamp]: new Date() },
  });

  let sent = 0;
  const failed: string[] = [];
  for (let i = 0; i < batch.length; i += 5) {
    await Promise.all(
      batch.slice(i, i + 5).map(async (u) => {
        try {
          await sendOne(u.email, audience);
          sent += 1;
        } catch (err) {
          failed.push(`${u.email} — ${err instanceof Error ? err.message : String(err)}`);
        }
      })
    );
    process.stdout.write(`\r  sent ${sent}/${batch.length}   `);
  }
  process.stdout.write("\n");

  const remaining = await db.user.count({ where });
  console.log(`  sent      : ${sent}`);
  console.log(`  failed    : ${failed.length}`);
  console.log(`  remaining : ${remaining}`);
  if (failed.length) {
    console.log(`\n  failures (clear ${stamp} on these rows to retry):`);
    failed.forEach((f) => console.log("    " + f));
  }
}

async function main() {
  if (!API_KEY) throw new Error("SENDBYTE_API_KEY is not set");

  // Test mode: one email to an explicit address across every audience copy.
  // Never stamps, so the real bulk run still reaches that address.
  if (TEST) {
    if (!ONLY) throw new Error("--test needs --to=address");
    const audiences: Audience[] =
      AUDIENCE === "all" ? ["unsigned", "signed"] : [AUDIENCE];
    console.log(`TEST MODE — sending ${audiences.length} copy(ies) to ${ONLY}, no progress recorded.`);
    for (const audience of audiences) {
      await sendOne(ONLY, audience);
      console.log(`  sent [${AUDIENCES[audience].label}] copy → ${ONLY}`);
    }
    return;
  }

  if (!APPLY) console.log("DRY RUN — nothing will be sent.");

  const targets: Audience[] = AUDIENCE === "all" ? ["unsigned", "signed"] : [AUDIENCE];
  for (const audience of targets) await sendAudience(audience);

  if (!APPLY) console.log("\nDRY RUN — nothing sent. Add --apply to send.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
