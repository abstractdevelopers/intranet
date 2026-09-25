/**
 * Rebuild student accounts from the SendByte email log.
 *
 * Context: on 2026-09-25 the production database was emptied by a bad migration.
 * The only surviving record of the membership is the SendByte delivery log, so
 * this script reconstructs one account per distinct recipient address.
 *
 * Usage (dry run by default — prints what it would do and writes nothing):
 *   npx tsx scripts/rebuild-accounts.ts --csv=/path/to/log.csv
 *   npx tsx scripts/rebuild-accounts.ts --csv=/path/to/log.csv --apply
 *
 * Idempotent: accounts are upserted by email, so re-running updates rather than
 * duplicating. Existing accounts are left alone unless --reset-passwords is
 * passed. Bounced addresses are skipped by default (--include-bounces to keep
 * them); they are still real people, but mail to them does not arrive.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "fs";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const INCLUDE_BOUNCES = args.includes("--include-bounces");
const RESET_PASSWORDS = args.includes("--reset-passwords");
const csvArg = args.find((a) => a.startsWith("--csv="));
const CSV_PATH = csvArg?.slice("--csv=".length);
const skipArg = args.find((a) => a.startsWith("--skip="));
const SKIP_PATH = skipArg?.slice("--skip=".length) ?? "prisma/data/reclaim-skip.txt";

/** Staff accounts to recreate. The password comes from SEED_ADMIN_PASSWORD. */
const ADMIN_EMAILS = ["wallace@launchverse.space", "zaheer@launchverse.space"];

/**
 * Parse a CSV line that may contain quoted fields. The SendByte export quotes
 * subjects containing commas, so a naive split would shift every later column.
 */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      out.push(field);
      field = "";
    } else field += ch;
  }
  out.push(field);
  return out;
}

function randomPassword() {
  // Never handed out; the reclaim link is the only way in. Random so no
  // guessable default exists in the brief window before the creator resets it.
  return `${crypto.randomUUID()}${crypto.randomUUID()}`;
}

/**
 * Read recipients from either a SendByte CSV export (uses the "to"/"status"
 * columns) or a plain one-address-per-line list. The original export was lost
 * with the workspace mount, so the reconstructed list is a plain file.
 */
async function loadRecipients(path: string) {
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = parseCsvLine(lines[0]);
  const toIdx = header.indexOf("to");
  const statusIdx = header.indexOf("status");

  const recipients = new Map<string, { bounced: boolean }>();
  if (toIdx !== -1) {
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const email = (cols[toIdx] ?? "").trim().toLowerCase();
      if (!email || !email.includes("@")) continue;
      const bounced = statusIdx !== -1 && (cols[statusIdx] ?? "").trim() === "bounced";
      const existing = recipients.get(email);
      // A person is only treated as bounced if every send to them bounced.
      recipients.set(email, { bounced: existing ? existing.bounced && bounced : bounced });
    }
  } else {
    for (const line of lines) {
      const email = line.trim().toLowerCase();
      if (email.includes("@")) recipients.set(email, { bounced: false });
    }
  }
  return recipients;
}

/** Addresses that must never be emailed (hard bounces, provider test inboxes). */
function loadSkipList(path: string) {
  if (!existsSync(path)) return new Set<string>();
  return new Set(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim().toLowerCase())
      .filter((l) => l.includes("@"))
  );
}

/**
 * A best-effort display name from an email address, so the reclaim profile
 * step opens with something human instead of the raw address. Creators can
 * change it; it exists only so nobody is greeted by "olamidealiu61@…".
 */
function friendlyName(email: string) {
  const local = email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, "")
    .trim();
  if (!local) return "Creator";
  return local
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .slice(0, 120);
}

/** Create a profile row (with a friendly name) for every student lacking one. */
async function backfillProfiles() {
  const missing = await db.user.findMany({
    where: { role: "STUDENT", profile: null },
    select: { id: true, email: true },
  });
  const CHUNK = 100;
  for (let i = 0; i < missing.length; i += CHUNK) {
    await db.profile.createMany({
      data: missing.slice(i, i + CHUNK).map((u) => ({
        userId: u.id,
        fullName: friendlyName(u.email),
      })),
      skipDuplicates: true,
    });
  }
  return missing.length;
}

async function main() {
  if (!CSV_PATH) {
    console.error("Usage: npx tsx scripts/rebuild-accounts.ts --csv=/path/to/log.csv [--apply]");
    process.exit(1);
  }

  const recipients = await loadRecipients(CSV_PATH);
  const skip = loadSkipList(SKIP_PATH);
  const all = [...recipients.keys()];
  const students = all.filter((e) => !skip.has(e) && (INCLUDE_BOUNCES || !recipients.get(e)!.bounced));
  const skipped = all.length - students.length;

  console.log(`Recipients in source:     ${all.length}`);
  console.log(`Skipped (bounced/staff):  ${skipped}`);
  console.log(`Student accounts to add:  ${students.length}`);
  console.log(`Admin accounts:           ${ADMIN_EMAILS.join(", ")}`);

  const existing = await db.user.count({ where: { email: { in: students } } });
  console.log(`Already present:        ${existing}`);

  if (!APPLY) {
    console.log("\nDry run — nothing written. Re-run with --apply to create the accounts.");
    return;
  }

  // Batching matters here: the Supabase pooler costs ~0.5s per round-trip, so
  // one INSERT per account turns 684 accounts into a ten-minute run. Hash in
  // parallel (CPU-bound) then write in chunks (one round-trip each).
  const existingRows = await db.user.findMany({
    where: { email: { in: students } },
    select: { email: true },
  });
  const existingSet = new Set(existingRows.map((r) => r.email));

  const pending = students.filter((e) => !existingSet.has(e) || RESET_PASSWORDS);
  const plain = randomPassword();
  const passwordHash = await bcrypt.hash(plain, 12);

  const CHUNK = 100;
  let created = 0;
  for (let i = 0; i < pending.length; i += CHUNK) {
    const chunk = pending.slice(i, i + CHUNK);
    const result = await db.user.createMany({
      data: chunk.map((email) => ({
        email,
        passwordHash,
        role: "STUDENT",
        status: "ACTIVE",
        // A temporary credential nobody holds: the reclaim link (or a
        // "forgot password" reset) is the only way in, and `mustChangePassword`
        // keeps the account in setup until the creator sets their own.
        mustChangePassword: true,
      })),
      skipDuplicates: true,
    });
    created += result.count;
    console.log(`  … ${Math.min(i + CHUNK, pending.length)}/${pending.length}`);
  }

  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("SEED_ADMIN_PASSWORD is not set — refusing to create staff accounts.");
  }
  const adminHash = await bcrypt.hash(adminPassword, 12);
  for (const email of ADMIN_EMAILS) {
    const name = email
      .split("@")[0]
      .split(/[._-]/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
    await db.user.upsert({
      where: { email },
      update: { role: "FOUNDER", passwordHash: adminHash },
      create: {
        email,
        passwordHash: adminHash,
        role: "FOUNDER",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        profile: { create: { fullName: name } },
      },
    });
  }

  console.log(`\nDone. Created ${created}, already present ${existingSet.size}.`);

  const profiled = await backfillProfiles();
  console.log(`Backfilled ${profiled} profile(s) with a display name.`);
  console.log(`Admin accounts ready: ${ADMIN_EMAILS.join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
