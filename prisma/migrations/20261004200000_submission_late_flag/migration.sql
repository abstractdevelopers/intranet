-- Record whether a submission arrived after its deadline.
--
-- Grading happens some time after submitting, so lateness has to be captured at
-- submit time or it is lost. A late submission under the PENALTY policy has a
-- deduction applied when it is graded.
--
-- Defaults to false, so existing submissions are unaffected.
ALTER TABLE "AssignmentSubmission" ADD COLUMN "late" BOOLEAN NOT NULL DEFAULT false;
