-- Content-preview bypass for scheduled course content.
--
-- Course modules and assignments release on a schedule (Module.releaseAt).
-- A reviewer needs to see that content BEFORE its release time to verify the
-- schedule works. This flag grants that bypass to named accounts only; it is
-- off for every other user, and the default leaves existing rows unaffected.
--
-- Granted to zaheercoderlts@gmail.com for verifying the 2026-10-05 rollout.
ALTER TABLE "User" ADD COLUMN "previewUnreleasedContent" BOOLEAN NOT NULL DEFAULT false;
