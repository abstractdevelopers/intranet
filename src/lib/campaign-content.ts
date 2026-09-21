/**
 * Builds the HTML and plain-text for a campaign. Images are resolved to public
 * URLs, and the unsubscribe link is left as a placeholder so one render can be
 * reused for every recipient — the sender substitutes a signed link per person.
 */

import { db } from "./db";
import { renderCampaign, campaignText, styleFor } from "./email-campaigns";

/** Replaced with a signed, per-recipient unsubscribe URL at send time. */
export const UNSUBSCRIBE_TOKEN = "%%UNSUBSCRIBE%%";

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://intranet.launchverse.site").replace(/\/$/, "");
}

/** Parse the stored JSON array of Document ids, tolerating bad data. */
export function parseImageIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Public URLs for a campaign's banner images, in display order. */
export function publicImageUrls(raw: string | null): string[] {
  return parseImageIds(raw).map((id) => `${appUrl()}/api/public/email-assets/${id}`);
}

export type CampaignContentInput = {
  eyebrow: string | null;
  heading: string;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  note: string | null;
  signoff: string | null;
  imageIds: string | null;
};

/** Branded HTML with the unsubscribe placeholder still in place. */
export async function campaignHtml(campaign: CampaignContentInput) {
  return renderCampaign({
    eyebrow: campaign.eyebrow ?? "UCA Sandbox",
    heading: campaign.heading,
    body: campaign.body,
    ctaLabel: campaign.ctaLabel,
    ctaUrl: campaign.ctaUrl,
    note: campaign.note,
    signoff: campaign.signoff,
    images: publicImageUrls(campaign.imageIds),
    unsubscribeUrl: UNSUBSCRIBE_TOKEN,
  });
}

export function campaignPlainText(campaign: CampaignContentInput) {
  return campaignText(campaign);
}

/** Style metadata for the admin UI, keyed by the built-in style name. */
export function campaignStyle(key: string | null) {
  return styleFor(key ?? "ANNOUNCEMENT");
}

/** Confirm each image id belongs to a stored Document, so a bad id can't 404. */
export async function validImageIds(ids: string[]) {
  if (ids.length === 0) return [];
  const found = await db.document.findMany({
    where: { id: { in: ids }, mimeType: { startsWith: "image/" } },
    select: { id: true },
  });
  const ok = new Set(found.map((d) => d.id));
  return ids.filter((id) => ok.has(id));
}