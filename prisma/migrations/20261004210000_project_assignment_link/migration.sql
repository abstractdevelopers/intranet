-- Link a portfolio piece to the assignment it came from.
--
-- Assignments allow several attempts, and every submission now becomes a
-- portfolio piece. Keying on the submission would give a student one piece per
-- attempt; keying on the assignment gives one piece per assignment, which is
-- what a portfolio should show.
--
-- Existing rows keep working: assignmentId starts NULL and is backfilled from
-- the submission each project already points at.
ALTER TABLE "Project" ADD COLUMN "assignmentId" TEXT;

UPDATE "Project" p
SET "assignmentId" = s."assignmentId"
FROM "AssignmentSubmission" s
WHERE p."submissionId" = s."id" AND p."assignmentId" IS NULL;

CREATE INDEX "Project_userId_assignmentId_idx" ON "Project"("userId", "assignmentId");

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
