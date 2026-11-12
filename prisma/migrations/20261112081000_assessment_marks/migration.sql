-- Per-question marks for written (TEXT) theory answers, keyed by question id.
-- MCQ questions are auto-scored and never stored here.
ALTER TABLE "AssessmentSubmission" ADD COLUMN "marks" JSONB;
