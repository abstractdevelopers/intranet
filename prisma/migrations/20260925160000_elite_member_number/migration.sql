-- Elite badge rank for creators who reclaimed early after the 2026-09-25
-- incident. Unique so two creators can never hold the same rank.
ALTER TABLE "User" ADD COLUMN "eliteMemberNumber" INTEGER;

CREATE UNIQUE INDEX "User_eliteMemberNumber_key" ON "User"("eliteMemberNumber");
