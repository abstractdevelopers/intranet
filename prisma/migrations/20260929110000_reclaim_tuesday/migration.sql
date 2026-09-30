-- Progress marker for the Tuesday "six days out" countdown email.
-- Its own column so this reclaim wave resumes independently of the others.
ALTER TABLE "User" ADD COLUMN "reclaimTuesdayEmailSentAt" TIMESTAMP(3);
