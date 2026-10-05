-- Progress column for the "courses are live" announcement.
--
-- Its own column, like the other bulk sends, so this wave resumes
-- independently: a rerun after a crash skips who was already reached and can
-- never email anyone twice.
ALTER TABLE "User" ADD COLUMN "coursesLiveEmailSentAt" TIMESTAMP(3);
