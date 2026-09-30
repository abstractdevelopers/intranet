-- Progress marker for the live opening-ceremony announcement sent to all
-- active students while the event was running.
ALTER TABLE "User" ADD COLUMN "openingCeremonyEmailSentAt" TIMESTAMP(3);
