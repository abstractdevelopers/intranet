/**
 * Campaign styles for the admin email announcer.
 *
 * A campaign is stored as plain text plus a chosen style. Each style maps to a
 * genuinely different card design (see email-campaign-layouts.ts) — different
 * structure, not one shell recoloured — and all of them use the UCA palette.
 */

import { LAYOUTS, parseBody, type LayoutKey } from "./email-campaign-layouts";

export { parseBody };
export type { Block } from "./email-campaign-layouts";

export type CampaignStyle = {
  key: LayoutKey;
  label: string;
  description: string;
  eyebrow: string;
};

/**
 * The five built-in styles. `key` selects the card design; `label` and
 * `description` drive the picker in the admin UI; `eyebrow` seeds a default.
 */
export const CAMPAIGN_STYLES: CampaignStyle[] = [
  {
    key: "BANNER",
    label: "Banner",
    description: "Purple gradient hero with your image and headline. Best for general announcements.",
    eyebrow: "Academy update",
  },
  {
    key: "SPLIT",
    label: "Split feature",
    description: "Image beside the headline in a two-column panel. Best for new courses and modules.",
    eyebrow: "New on UCA Sandbox",
  },
  {
    key: "TICKET",
    label: "Invitation",
    description: "Centred, with a dashed stub for the date or deadline. Best for events and live sessions.",
    eyebrow: "You're invited",
  },
  {
    key: "SPOTLIGHT",
    label: "Spotlight",
    description: "Full purple card with a bright button. Best for celebrations and big wins.",
    eyebrow: "Celebrating you",
  },
  {
    key: "NOTE",
    label: "Note",
    description: "Plain, left-ruled card with bullets. Best for reminders and checklists.",
    eyebrow: "A quick reminder",
  },
];

export function styleFor(key: string | null): CampaignStyle {
  return CAMPAIGN_STYLES.find((s) => s.key === key) ?? CAMPAIGN_STYLES[0];
}

/** Plain-text fallback — always mirrors the HTML content. */
export function campaignText(input: {
  heading: string;
  body: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  note?: string | null;
  signoff?: string | null;
}): string {
  const lines = [input.heading, ""];
  for (const block of parseBody(input.body)) {
    lines.push(block.kind === "link" ? `${block.label}: ${block.url}` : block.text, "");
  }
  if (input.ctaLabel && input.ctaUrl) lines.push(`${input.ctaLabel}: ${input.ctaUrl}`, "");
  if (input.note) lines.push(input.note, "");
  lines.push(input.signoff ?? "— The UCA Sandbox team");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Render a campaign to HTML using the chosen card design. `style` is the
 * campaign's style key; anything unrecognised falls back to the banner design.
 */
export function renderCampaign(
  input: {
    eyebrow: string;
    heading: string;
    body: string;
    ctaLabel?: string | null;
    ctaUrl?: string | null;
    note?: string | null;
    signoff?: string | null;
    images?: string[];
    preheader?: string;
    unsubscribeUrl?: string;
  },
  style: string = "BANNER"
): string {
  const layout = LAYOUTS[style as LayoutKey] ?? LAYOUTS.BANNER;
  return layout(input);
}