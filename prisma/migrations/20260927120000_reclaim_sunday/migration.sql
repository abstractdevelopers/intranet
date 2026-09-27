-- Progress marker for the Sunday "eight days out" countdown email.
-- Its own column so this reclaim wave resumes independently of the others.
ALTER TABLE "User" ADD COLUMN "reclaimSundayEmailSentAt" TIMESTAMP(3);
