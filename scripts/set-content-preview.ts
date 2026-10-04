/**
 * Grant or revoke the content-preview bypass (User.previewUnreleasedContent).
 *
 * A preview account sees modules and assignments before their releaseAt, so
 * scheduled content can be verified before it goes live. It only skips the
 * RELEASE gate: the sequential and Captain's Log rules still apply, so the
 * account sees content without a broken progress state.
 *
 * Usage:
 *   npx tsx scripts/set-content-preview.ts zaheercoderlts@gmail.com           (dry run)
 *   npx tsx scripts/set-content-preview.ts zaheercoderlts@gmail.com --apply
 *   npx tsx scripts/set-content-preview.ts zaheercoderlts@gmail.com --apply --off
 *   npx tsx scripts/set-content-preview.ts --list
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const OFF = args.includes("--off");
const LIST = args.includes("--list");
const EMAIL = args.find((a) => !a.startsWith("--"));

async function main() {
  if (LIST) {
    const users = await db.user.findMany({
      where: { previewUnreleasedContent: true },
      select: { email: true, role: true, status: true },
      orderBy: { email: "asc" },
    });
    console.log(`Preview accounts: ${users.length}`);
    users.forEach((u) => console.log(`  ${u.email}  (${u.role}, ${u.status})`));
    return;
  }

  if (!EMAIL) throw new Error("Pass an email, or --list");

  const user = await db.user.findUnique({
    where: { email: EMAIL.toLowerCase() },
    select: { id: true, email: true, role: true, previewUnreleasedContent: true },
  });
  if (!user) throw new Error(`No user with email ${EMAIL}`);

  const next = !OFF;
  console.log(`${user.email} (${user.role})`);
  console.log(`  preview: ${user.previewUnreleasedContent} -> ${next}`);

  if (!APPLY) {
    console.log("\nDry run — nothing changed. Re-run with --apply.");
    return;
  }

  await db.user.update({ where: { id: user.id }, data: { previewUnreleasedContent: next } });
  console.log(`\n${next ? "Granted" : "Revoked"} content preview for ${user.email}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
