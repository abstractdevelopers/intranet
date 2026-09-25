-- Studio Wall: each promise also carries the deliverable the student is aiming
-- at ("by the end of term I will have made..."). Nullable so existing rows and
-- students who only write a promise are unaffected.
ALTER TABLE "Promise" ADD COLUMN "ambition" TEXT;
