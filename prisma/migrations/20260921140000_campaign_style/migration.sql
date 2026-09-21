-- Which card design a campaign renders in. Existing campaigns keep the
-- original single layout, which is the BANNER design.
ALTER TABLE "EmailCampaign" ADD COLUMN "style" TEXT NOT NULL DEFAULT 'BANNER';