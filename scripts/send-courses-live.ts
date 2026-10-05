/**
 * Send the "courses are live" announcement.
 *
 * Two audiences, each with its own copy and its own progress column:
 *
 *   --audience=signed-up   Students with an ACCEPTED enrolment. Copy is the
 *                          week-one-is-open note, CTA "Continue learning".
 *   --audience=waiting     Waiting-list accounts that never signed up. Copy
 *                          offers a final reclaim, CTA mints a single-use
 *                          password link.
 *
 * Progress lives in User.coursesLiveEmailSentAt, stamped BEFORE each send, so a
 * crash can skip someone but a retry can never email anyone twice.
 *
 * Usage (dry run by default — prints the count and sends nothing):
 *   npx tsx scripts/send-courses-live.ts --audience=signed-up
 *   npx tsx scripts/send-courses-live.ts --audience=signed-up --apply
 *   npx tsx scripts/send-courses-live.ts --audience=waiting --apply --limit=25
 *   npx tsx scripts/send-courses-live.ts --audience=waiting --test --to=me@example.com
 *
 * --test does not stamp, so a later bulk run still reaches that address.
 */
import { PrismaClient } from "@prisma/client";
import { coursesLiveEmail, coursesLiveWaitingListEmail } from "../src/lib/email-templates";
import { WELCOME_TOKEN_TTL_MS } from "../src/lib/welcome";
import { readFileSync, existsSync } from "fs";
import crypto from "crypto";

const db = new PrismaClient();

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const TEST = args.includes("--test");
const AUDIENCE = args.find((a) => a.startsWith("--audience="))?.split("=")[1] ?? "";
const LIMIT = Number.parseInt(
  args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "25",
  10
);
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

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://intranet.launchverse.site").replace(
  /\/$/,
  ""
);
const API_KEY = process.env.SENDBYTE_API_KEY;
const FROM = process.env.EMAIL_FROM ?? "Unify Creator Academy <uca@launchverse.site>";
const API = "https://api.sendbyte.africa/v1/emails";

/**
 * Provider ceiling: SendByte allows 120 requests per 60s per API key, counted
 * across every caller. Stay under it — a throttled send would fail recipients
 * who have already been stamped as sent.
 */
const RATE_LIMIT_PER_MIN = 100;
const RATE_WINDOW_MS = 60_000;
const recentSends: number[] = [];

async function pace() {
  for (;;) {
    const now = Date.now();
    while (recentSends.length && now - recentSends[0] > RATE_WINDOW_MS) recentSends.shift();
    if (recentSends.length < RATE_LIMIT_PER_MIN) {
      recentSends.push(now);
      return;
    }
    await new Promise((r) => setTimeout(r, RATE_WINDOW_MS - (now - recentSends[0]) + 50));
  }
}

async function sendOne(to: string, subject: string, html: string, text: string) {
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
  if (AUDIENCE !== "signed-up" && AUDIENCE !== "waiting") {
    throw new Error("Pass --audience=signed-up or --audience=waiting");
  }
  if (!TEST && !API_KEY && APPLY) throw new Error("SENDBYTE_API_KEY is not set");

  const suppressed = loadNoEmail(NO_EMAIL_PATH);

  // The audiences mirror campaign-sender.ts, with one addition: this send also
  // excludes anyone already reached by this wave.
  const base =
    AUDIENCE === "signed-up"
      ? { role: "STUDENT", status: "ACTIVE", enrollments: { some: { status: "ACCEPTED" } } }
      : {
          role: "STUDENT",
          status: "ACTIVE",
          username: null,
          onboardingCompletedAt: null,
          applications: { none: {} },
          enrollments: { none: {} },
        };

  const recipients = await db.user.findMany({
    where: {
      // A test send targets one address and skips the audience rules, so
      // delivery can be checked without a matching student.
      ...(TEST && ONLY ? {} : base),
      emailOptOutAt: null,
      coursesLiveEmailSentAt: null,
      ...(ONLY ? { email: ONLY } : {}),
    },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
    take: ONLY ? 1 : LIMIT,
  });

  const remaining = TEST && ONLY ? 1 : await db.user.count({
    where: { ...base, emailOptOutAt: null, coursesLiveEmailSentAt: null },
  });

  console.log(`Audience : ${AUDIENCE}`);
  console.log(`Queued   : ${recipients.length} of ${remaining} not-yet-emailed`);
  console.log(`Suppressed (bounce list): ${suppressed.length} address(es)`);
  console.log(`Mode     : ${TEST ? "TEST (no stamp)" : APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`App URL  : ${APP_URL}`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of recipients) {
    if (suppressed.includes(r.email.toLowerCase())) {
      skipped++;
      continue;
    }

    let subject: string;
    let html: string;
    let text: string;

    if (AUDIENCE === "signed-up") {
      ({ subject, html, text } = coursesLiveEmail({ link: `${APP_URL}/student/courses` }));
    } else {
      const token = await mintToken(r.id);
      ({ subject, html, text } = coursesLiveWaitingListEmail({
        email: r.email,
        link: `${APP_URL}/reset-password?token=${token}`,
      }));
    }

    if (TEST) {
      await pace();
      await sendOne(r.email, subject, html, text);
      console.log(`  [test] ${r.email}`);
      sent++;
      continue;
    }

    if (!APPLY) {
      console.log(`  [dry] ${r.email}  "${subject}"`);
      sent++;
      continue;
    }

    await pace();
    // Stamped BEFORE the send: a crash can skip someone, but never double-send.
    await db.user.update({
      where: { id: r.id },
      data: { coursesLiveEmailSentAt: new Date() },
    });
    try {
      await sendOne(r.email, subject, html, text);
      sent++;
    } catch (err) {
      // A non-2xx response means the provider rejected it, so nothing was
      // delivered. Clearing the stamp lets a rerun retry this person instead of
      // losing them. A hard crash still can't double-send, because the stamp
      // was already written above.
      await db.user.update({
        where: { id: r.id },
        data: { coursesLiveEmailSentAt: null },
      });
      failed++;
      console.error(`  [failed] ${r.email}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log();
  console.log(`Done. sent=${sent} skipped=${skipped} failed=${failed}`);
  const left = await db.user.count({
    where: { ...base, emailOptOutAt: null, coursesLiveEmailSentAt: null },
  });
  console.log(`Still queued: ${left}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
