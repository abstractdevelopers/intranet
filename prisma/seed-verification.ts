/**
 * Backfill verification badges.
 *
 * GOLD goes to the founding team listed in GOLD_VERIFIED_EMAILS; every other
 * account already in the database gets BLUE. Accounts created after this run are
 * left untouched, so badge granting stays a deliberate decision.
 *
 *   npx tsx prisma/seed-verification.ts
 */
import { PrismaClient } from "@prisma/client";
import { tierForEmail } from "../src/lib/constants";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });

  let gold = 0;
  let blue = 0;
  for (const user of users) {
    const tier = tierForEmail(user.email);
    await prisma.user.update({ where: { id: user.id }, data: { verificationTier: tier } });
    if (tier === "GOLD") gold++;
    else blue++;
  }

  console.log(`Verification badges assigned: ${gold} gold, ${blue} blue (${users.length} total).`);
}

main().finally(() => prisma.$disconnect());