/**
 * Send the "password access is fixed" notice to everyone who has an account.
 *
 * Usage (dry run by default — prints the recipient count and sends nothing):
 *   npx tsx scripts/send-notice.ts
 *   npx tsx scripts/send-notice.ts --apply
 *   npx tsx scripts/send-notice.ts --apply --limit=50
 *   npx tsx scripts/send-notice.ts --apply --to=someone@example.com
 *
 * Progress is recorded in User.noticeEmailSentAt, so re-running resumes rather
 * than resending. That column is written BEFORE each send, so an interrupted
 * run can skip someone but can never email anyone twice. Failures are listed at
 * the end so they can be retried explicitly.
 */
import { PrismaClient } from "@prisma/client";
import { passwordFixedNoticeEmail } from "../src/lib/email-templates";

const db = new PrismaClient();

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const RESEND = args.includes("--resend");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number.parseInt(limitArg.split("=")[1], 10) : 25;
const onlyArg = args.find((a) => a.startsWith("--to="));
const ONLY = onlyArg ? onlyArg.slice("--to=".length) : null;

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://intranet.launchverse.site").replace(/\/$/, "");
const API_KEY = process.env.SENDBYTE_API_KEY;
const FROM = process.env.EMAIL_FROM ?? "Unify Creator Academy <uca@launchverse.site>";
const API = "https://api.sendbyte.africa/v1/emails";

async function sendOne(to: string) {
  const { subject, html, text } = passwordFixedNoticeEmail({
    email: to,
    loginUrl: `${APP_URL}/login`,
    forgotUrl: `${APP_URL}/forgot-password`,
  });
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

async function main() {
  if (!API_KEY) throw new Error("SENDBYTE_API_KEY is not set");

  // Only ACTIVE students: this is an announcement to account holders about their
  // own access, so staff and anyone suspended or rejected are excluded.
  const where = {
    role: "STUDENT",
    status: "ACTIVE",
    ...(RESEND ? {} : { noticeEmailSentAt: null }),
    ...(ONLY ? { email: ONLY } : {}),
  };

  const total = await db.user.count({ where });
  const everyone = await db.user.count({ where: { role: "STUDENT", status: "ACTIVE" } });
  console.log(`account holders (ACTIVE) : ${everyone}`);
  console.log(`already notified         : ${everyone - total}`);
  console.log(`pending                  : ${total}`);
  console.log(`this run will send       : ${Math.min(LIMIT, total)}`);

  if (!APPLY) {
    console.log("\nDRY RUN — nothing sent. Add --apply to send.");
    return;
  }

  const batch = await db.user.findMany({
    where,
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
    take: LIMIT,
  });

  // Stamp first: never duplicate a send, even if this process dies mid-way.
  await db.user.updateMany({
    where: { id: { in: batch.map((u) => u.id) } },
    data: { noticeEmailSentAt: new Date() },
  });

  let sent = 0;
  const failed: string[] = [];
  for (let i = 0; i < batch.length; i += 5) {
    await Promise.all(
      batch.slice(i, i + 5).map(async (u) => {
        try {
          await sendOne(u.email);
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
  console.log(`\nsent      : ${sent}`);
  console.log(`failed    : ${failed.length}`);
  console.log(`remaining : ${remaining}`);
  if (failed.length) {
    console.log("\nfailures (clear noticeEmailSentAt to retry):");
    failed.forEach((f) => console.log("  " + f));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());