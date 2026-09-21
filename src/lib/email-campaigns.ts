/**
 * Campaign rendering for the admin email announcer.
 *
 * A campaign is stored as plain text plus a chosen style. This module turns
 * that into branded HTML at send time, so the same content can be re-rendered
 * for a preview, for a test send, or by a background worker.
 *
 * Body conventions (kept deliberately simple so admins don't need HTML):
 *   - blank line  → new paragraph
 *   - "Label: https://..." on its own line → a secondary link line
 *   - everything else → paragraph text
 */

const BRAND_1 = "#570e83";
const ACCENT = "#e6a9ff";

export type CampaignStyle = {
  key: string;
  label: string;
  description: string;
  eyebrow: string;
  headingPrefix?: string;
};

/**
 * The five built-in styles. `label`/`description` drive the picker in the
 * admin UI; the rest seeds a new campaign's defaults.
 */
export const CAMPAIGN_STYLES: CampaignStyle[] = [
  {
    key: "ANNOUNCEMENT",
    label: "Academy announcement",
    description: "A general update for the whole academy.",
    eyebrow: "Academy update",
  },
  {
    key: "NEW_COURSE",
    label: "New course or module",
    description: "Announce newly published learning content.",
    eyebrow: "New on UCA Sandbox",
  },
  {
    key: "EVENT",
    label: "Event invitation",
    description: "Invite students to a live session or deadline.",
    eyebrow: "You're invited",
  },
  {
    key: "MILESTONE",
    label: "Celebration",
    description: "Recognise progress, wins, or a cohort milestone.",
    eyebrow: "Celebrating you",
  },
  {
    key: "REMINDER",
    label: "Friendly reminder",
    description: "Nudge students about something outstanding.",
    eyebrow: "A quick reminder",
  },
];

export function styleFor(key: string): CampaignStyle {
  return CAMPAIGN_STYLES.find((s) => s.key === key) ?? CAMPAIGN_STYLES[0];
}

/** One parsed line of campaign body copy. */
type Block = { kind: "paragraph"; text: string } | { kind: "link"; label: string; url: string };

const LINK_LINE = /^([^:]{2,60}):\s*(https?:\/\/\S+)$/i;

/** Split raw body text into renderable blocks. */
export function parseBody(body: string): Block[] {
  return body
    .split(/\n{2,}/)
    .flatMap((chunk) => chunk.split("\n"))
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(LINK_LINE);
      return match
        ? { kind: "link" as const, label: match[1].trim(), url: match[2].trim() }
        : { kind: "paragraph" as const, text: line };
    });
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
 * The branded HTML shell. Kept here rather than reused from email-templates.ts
 * because campaign assets need public image URLs and an unsubscribe footer,
 * which the transactional templates deliberately don't have.
 */
export function renderCampaign(input: {
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
}): string {
  const ink = "#0d070b";
  const muted = "#6b6470";
  const surface2 = "#f4f0f7";
  const border = "#e7e0ec";
  const font =
    "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  const esc = (v: string) =>
    v
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const blocks = parseBody(input.body);
  const content = blocks
    .map((block) =>
      block.kind === "link"
        ? `<p style="margin:0 0 16px;font-family:${font};font-size:15px;line-height:24px;color:${ink};"><a href="${esc(
            block.url
          )}" target="_blank" style="color:${BRAND_1};text-decoration:underline;">${esc(block.label)}</a></p>`
        : `<p style="margin:0 0 16px;font-family:${font};font-size:15px;line-height:24px;color:${ink};">${esc(
            block.text
          )}</p>`
    )
    .join("");

  const images = (input.images ?? [])
    .map(
      (url) =>
        `<img src="${esc(url)}" alt="" width="528" style="display:block;width:100%;max-width:528px;height:auto;border:0;border-radius:8px;margin:0 0 20px;" />`
    )
    .join("");

  const cta =
    input.ctaLabel && input.ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 4px;">
          <tr><td align="center" bgcolor="${BRAND_1}" style="border-radius:8px;">
            <a href="${esc(input.ctaUrl)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${font};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${esc(
              input.ctaLabel
            )}</a>
          </td></tr>
        </table>`
      : "";

  const note = input.note
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
        <tr><td bgcolor="${surface2}" style="border-left:3px solid ${ACCENT};border-radius:0 6px 6px 0;padding:14px 16px;">
          <p style="margin:0;font-family:${font};font-size:13px;line-height:20px;color:${muted};">${esc(
            input.note
          )}</p>
        </td></tr>
      </table>`
    : "";

  const signoff = `<p style="margin:24px 0 0;font-family:${font};font-size:14px;line-height:22px;color:${ink};">${esc(
    input.signoff ?? "— The UCA Sandbox team"
  )}</p>`;

  const footer = [
    "UCA Sandbox — Unify Creator Academy",
    "You're receiving this because you have a UCA Sandbox account.",
  ];
  if (input.unsubscribeUrl) {
    footer.push(
      `<a href="${esc(input.unsubscribeUrl)}" target="_blank" style="color:${BRAND_1};text-decoration:underline;">Unsubscribe from academy emails</a>`
    );
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${esc(input.heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:${surface2};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(input.preheader ?? input.heading)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${surface2};padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${border};">
      <tr>
        <td bgcolor="${BRAND_1}" style="background:linear-gradient(135deg,${BRAND_1} 0%,#410b61 55%,#2d0745 100%);padding:32px 36px 28px;">
          <p style="margin:0;font-family:${font};font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${ACCENT};">${esc(
            input.eyebrow
          )}</p>
          <h1 style="margin:8px 0 0;font-family:${font};font-size:24px;line-height:32px;font-weight:700;color:#ffffff;">${esc(
            input.heading
          )}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 36px 36px;">
          ${images}
          ${content}
          ${cta}
          ${note}
          ${signoff}
        </td>
      </tr>
      <tr>
        <td bgcolor="${surface2}" style="padding:20px 36px;border-top:1px solid ${border};">
          <p style="margin:0;font-family:${font};font-size:12px;line-height:20px;color:${muted};">${footer.join(
            "<br />"
          )}</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
