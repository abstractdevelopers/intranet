-- Verification badge tier shown beside a member name.
-- GOLD = founding team, BLUE = every other signed-up account, NULL = no badge.
ALTER TABLE "User" ADD COLUMN "verificationTier" TEXT;
