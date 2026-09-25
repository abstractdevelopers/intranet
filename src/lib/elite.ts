import { db } from "./db";
import { ELITE_BADGE_LIMIT } from "./constants";

/**
 * Elite badge allocation.
 *
 * The first `ELITE_BADGE_LIMIT` returning creators to finish reclaiming get a
 * permanent, numbered Elite badge. Allocation is a race, so it is done with a
 * bounded retry against the unique index on `User.eliteMemberNumber`: if two
 * creators claim simultaneously and land on the same number, the loser re-reads
 * the count and takes the next one. The ceiling is therefore honoured exactly —
 * a 101st creator can never be granted a badge, however tight the timing.
 */
export async function claimEliteStatus(userId: string): Promise<number | null> {
  // Already earned: return it unchanged so re-running is idempotent.
  const current = await db.user.findUnique({
    where: { id: userId },
    select: { eliteMemberNumber: true },
  });
  if (current?.eliteMemberNumber) return current.eliteMemberNumber;

  for (let attempt = 0; attempt < 8; attempt++) {
    const taken = await db.user.count({ where: { eliteMemberNumber: { not: null } } });
    if (taken >= ELITE_BADGE_LIMIT) return null;

    const nextNumber = taken + 1;
    try {
      // Guarded update: only fills the field if it is still empty, so a repeat
      // call can't overwrite a rank already granted.
      const updated = await db.user.updateMany({
        where: { id: userId, eliteMemberNumber: null },
        data: { eliteMemberNumber: nextNumber },
      });
      if (updated.count === 0) {
        const again = await db.user.findUnique({
          where: { id: userId },
          select: { eliteMemberNumber: true },
        });
        return again?.eliteMemberNumber ?? null;
      }
      return nextNumber;
    } catch {
      // Unique collision on the number: another claim won this rank. Retry.
    }
  }

  // Extremely contended; better to grant no badge than the wrong rank.
  return null;
}

/** How many Elite places are still open (for the welcome/status copy). */
export async function elitePlacesRemaining() {
  const taken = await db.user.count({ where: { eliteMemberNumber: { not: null } } });
  return Math.max(0, ELITE_BADGE_LIMIT - taken);
}
