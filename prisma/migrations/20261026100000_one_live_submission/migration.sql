-- One live submission per student per assignment.
--
-- A student may submit only while nothing is pending or graded. A submission is
-- "live" from the moment it arrives until it is graded; the reviewer can reopen
-- the assignment by asking for a revision, which moves the row to
-- NEEDS_REVISION and takes it out of the live set.
--
-- The route already refuses a second live submission, but two requests can be
-- in flight at once (two tabs, a double tap, a retried fetch). Both would pass a
-- read-then-insert check and both would insert. This index is what actually
-- guarantees the invariant, because the database evaluates it per row.
--
-- Scoped by status so history is preserved: graded rows and requested revisions
-- accumulate freely, and only one SUBMITTED/RESUBMITTED row may exist at a time.
--
-- Existing data already breaks this in four places — every one a resubmission
-- while the first was still ungraded. Those older rows are retired to
-- SUPERSEDED below, which keeps the work and its history but removes it from
-- the live set. No grade is affected: none of the four pairs carries a grade.
UPDATE "AssignmentSubmission" AS old
SET status = 'SUPERSEDED'
WHERE old.status IN ('SUBMITTED', 'RESUBMITTED')
  AND EXISTS (
    SELECT 1 FROM "AssignmentSubmission" AS newer
    WHERE newer."assignmentId" = old."assignmentId"
      AND newer."userId" = old."userId"
      AND newer.status IN ('SUBMITTED', 'RESUBMITTED')
      AND newer."attempt" > old."attempt"
  );

CREATE UNIQUE INDEX "AssignmentSubmission_one_live_per_assignment"
  ON "AssignmentSubmission" ("assignmentId", "userId")
  WHERE status IN ('SUBMITTED', 'RESUBMITTED');
