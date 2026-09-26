-- Progress marker for the "four clicks away" reclaim follow-up. Kept separate
-- from welcomeEmailSentAt so this nudge can be resumed independently of the
-- first reclaim send that already stamped that column.
ALTER TABLE "User" ADD COLUMN "reclaimNudgeEmailSentAt" TIMESTAMP(3);
