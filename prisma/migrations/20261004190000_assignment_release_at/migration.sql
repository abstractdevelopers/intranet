-- Per-assignment release time.
--
-- A week's Module opens on Monday, but its assignment may not open until
-- Wednesday. The module-level gate cannot express that, so an assignment can
-- now carry its own releaseAt.
--
-- NULL means "inherit the module's release time", so every existing assignment
-- is unaffected: the column starts NULL for all of them.
ALTER TABLE "Assignment" ADD COLUMN "releaseAt" TIMESTAMP(3);
