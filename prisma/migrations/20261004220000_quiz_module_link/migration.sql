-- Tie a quiz to the week it belongs to.
--
-- Intranet 101 is academy-wide and stays unlinked (moduleId NULL), so existing
-- behaviour is unchanged. A week quiz gets a moduleId, and its releaseAt lets it
-- open at a different moment from the rest of the week (null inherits the
-- module's releaseAt).
ALTER TABLE "Quiz" ADD COLUMN "moduleId" TEXT;
ALTER TABLE "Quiz" ADD COLUMN "releaseAt" TIMESTAMP(3);

CREATE INDEX "Quiz_moduleId_idx" ON "Quiz"("moduleId");

ALTER TABLE "Quiz"
  ADD CONSTRAINT "Quiz_moduleId_fkey"
  FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;
