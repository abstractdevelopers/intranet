-- Per-day release for lessons.
--
-- A week's content is delivered day by day (Monday's lessons, then Tuesday's),
-- but a week is a single Module row whose releaseAt gates the whole week. This
-- adds a lesson-level release so Tuesday's lessons can stay hidden after the
-- week has opened.
--
-- NULL means "inherit the module's release time", which is why every existing
-- row is unaffected: the column starts NULL for all of them.
ALTER TABLE "Lesson" ADD COLUMN "releaseAt" TIMESTAMP(3);
