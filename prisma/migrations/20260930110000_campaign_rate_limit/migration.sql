-- Provider pacing and single-flight guards for campaign sending.
--
-- SendByte caps at 120 requests per 60s per API key. Throttling in-process is
-- not enough: the pg_cron worker and an admin "Drain" can overlap, each staying
-- under the ceiling while together exceeding it. Both guards therefore live in
-- the database so they are shared across processes.
CREATE TABLE "CampaignRateWindow" (
  "id" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CampaignRateWindow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignRunLease" (
  "id" TEXT NOT NULL,
  "holder" TEXT NOT NULL,
  "acquiredAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignRunLease_pkey" PRIMARY KEY ("id")
);
