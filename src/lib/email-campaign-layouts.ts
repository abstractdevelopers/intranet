/**
 * Five distinct email card designs, all in the UCA palette.
 *
 * These are different HTML structures, not one shell recoloured:
 *   BANNER     gradient hero, left-aligned editorial card
 *   SPLIT      compact header + two-column feature panel
 *   TICKET     centred invitation with a dashed details stub
 *   SPOTLIGHT  full-purple card, centred, accent-coloured CTA
 *   NOTE       no hero, left accent rail, bulleted list, outlined CTA
 *
 * Constraints every layout respects:
 *   - tables only (no flex/grid), inline styles, bgcolor fallbacks for Outlook
 *   - the logo is a WHITE png, so it always sits on a purple band
 *   - gradients are always paired with a solid bgcolor fallback
 */

const BRAND_1 = "#570e83";
const BRAND_DEEP = "#2d0745";
const BRAND_MID = "#410b61";
const ACCENT = "#e6a9ff";
const INK = "#0d070b";
const MUTED = "#6b6470";
const SURFACE = "#f4f0f7";
const SURFACE_WARM = "#faf7fc";
const BORDER = "#e7e0ec";

const FONT =
  "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const EMAIL_LOGO_URL =
  process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/uca-logo.png`
    : "https://intranet.launchverse.site/uca-logo.png";

export function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type Block = { kind: "paragraph"; text: string } | { kind: "link"; label: string; url: string };

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

export type LayoutInput = {
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
};

export type LayoutKey = "BANNER" | "SPLIT" | "TICKET" | "SPOTLIGHT" | "NOTE";

/* ------------------------------------------------------------------ */
/* shared pieces                                                       */
/* ------------------------------------------------------------------ */

/** The white monogram, always on a purple band. */
function logo(size: "sm" | "md" = "md", align: "left" | "center" = "left") {
  const width = size === "sm" ? 52 : 64;
  return `<img src="${esc(EMAIL_LOGO_URL)}" alt="UCA" width="${width}" height="${
    size === "sm" ? 32 : 40
  }" style="display:block;border:0;outline:none;width:${width}px;height:auto;" />`
    .replace('style="display:block;', `style="display:block;margin:${align === "center" ? "0 auto;" : "0;"}`);
}

function paragraphs(blocks: Block[], opts: { color?: string; align?: "left" | "center" } = {}) {
  const color = opts.color ?? INK;
  const align = opts.align ?? "left";
  return blocks
    .map((block) =>
      block.kind === "link"
        ? `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:24px;color:${color};text-align:${align};"><a href="${esc(
            block.url
          )}" target="_blank" style="color:${BRAND_1};text-decoration:underline;">${esc(block.label)}</a></p>`
        : `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:24px;color:${color};text-align:${align};">${esc(
            block.text
          )}</p>`
    )
    .join("");
}

/** Paragraphs rendered as an accent-bulleted list. */
function bulletList(blocks: Block[]) {
  return blocks
    .map((block) => {
      const inner =
        block.kind === "link"
          ? `<a href="${esc(block.url)}" target="_blank" style="color:${BRAND_1};text-decoration:underline;">${esc(
              block.label
            )}</a>`
          : esc(block.text);
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;">
        <tr>
          <td width="18" valign="top" style="padding-top:6px;">
            <div style="width:8px;height:8px;background:${ACCENT};border-radius:2px;"></div>
          </td>
          <td style="font-family:${FONT};font-size:15px;line-height:24px;color:${INK};">${inner}</td>
        </tr>
      </table>`;
    })
    .join("");
}

function imagesBlock(images: string[], opts: { align?: "left" | "center"; radius?: number } = {}) {
  return images
    .map(
      (url) =>
        `<img src="${esc(url)}" alt="" width="528" style="display:block;width:100%;max-width:528px;height:auto;border:0;border-radius:${
          opts.radius ?? 8
        }px;margin:${opts.align === "center" ? "0 auto 20px" : "0 0 20px"};" />`
    )
    .join("");
}

type ButtonOpts = {
  label: string;
  url: string;
  variant: "filled" | "outlined" | "accent";
  align?: "left" | "center";
  fullWidth?: boolean;
};

function button({ label, url, variant, align = "left", fullWidth = false }: ButtonOpts) {
  const bg = variant === "filled" ? BRAND_1 : variant === "accent" ? ACCENT : "#ffffff";
  const fg = variant === "accent" ? BRAND_DEEP : variant === "outlined" ? BRAND_1 : "#ffffff";
  const border = variant === "outlined" ? `border:2px solid ${BRAND_1};` : "border:0;";
  const width = fullWidth ? "display:block;width:100%;" : "display:inline-block;";
  const pad = fullWidth ? "16px 20px" : "14px 28px";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px ${
    align === "center" ? "auto" : "0"
  } 4px;${fullWidth ? "width:100%;" : ""}">
    <tr><td align="center" bgcolor="${bg}" style="border-radius:8px;${border}">
      <a href="${esc(url)}" target="_blank" style="${width}padding:${pad};font-family:${FONT};font-size:15px;font-weight:600;color:${fg};text-decoration:none;border-radius:8px;">${esc(
        label
      )}</a>
    </td></tr>
  </table>`;
}

/** Mailchimp-style footer: who sent it, why, and how to leave. */
function footer(opts: { dark?: boolean; align?: "left" | "center" } = {}) {
  return (input: LayoutInput) => {
    const textColor = opts.dark ? "#d9c7e8" : MUTED;
    const linkColor = opts.dark ? ACCENT : BRAND_1;
    const align = opts.align ?? "left";
    const lines = [
      `UCA Sandbox — Unify Creator Academy`,
      `You're receiving this because you have a UCA Sandbox account.`,
      `© ${new Date().getFullYear()} Unify Creator Academy. All rights reserved.`,
    ];
    if (input.unsubscribeUrl) {
      lines.push(
        `<a href="${esc(
          input.unsubscribeUrl
        )}" target="_blank" style="color:${linkColor};text-decoration:underline;">Unsubscribe from academy emails</a>`
      );
    }
    return `<p style="margin:0;font-family:${FONT};font-size:12px;line-height:20px;color:${textColor};text-align:${align};">${lines.join(
      "<br />"
    )}</p>`;
  };
}

/** Document shell shared by every layout. */
function document(input: LayoutInput, pageBg: string, inner: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${esc(input.heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:${pageBg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(
    input.preheader ?? input.heading
  )}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${pageBg}" style="background-color:${pageBg};padding:32px 12px;">
  <tr><td align="center">
${inner}
  </td></tr>
</table>
</body>
</html>`;
}

function cta(input: LayoutInput, opts: Omit<ButtonOpts, "label" | "url">) {
  return input.ctaLabel && input.ctaUrl
    ? button({ label: input.ctaLabel, url: input.ctaUrl, ...opts })
    : "";
}

/* ------------------------------------------------------------------ */
/* 1. BANNER — gradient hero, left-aligned editorial card              */
/* ------------------------------------------------------------------ */
function banner(input: LayoutInput) {
  const blocks = parseBody(input.body);
  const card = `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">
  <tr>
    <td bgcolor="${BRAND_1}" style="background:linear-gradient(135deg,${BRAND_1} 0%,${BRAND_MID} 55%,${BRAND_DEEP} 100%);padding:32px 36px 28px;">
      ${logo()}
      <p style="margin:18px 0 0;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${ACCENT};">${esc(
        input.eyebrow
      )}</p>
      <h1 style="margin:8px 0 0;font-family:${FONT};font-size:26px;line-height:34px;font-weight:700;color:#ffffff;">${esc(
        input.heading
      )}</h1>
    </td>
  </tr>
  <tr>
    <td style="padding:32px 36px 36px;">
      ${imagesBlock(input.images ?? [])}
      ${paragraphs(blocks)}
      ${cta(input, { variant: "filled" })}
      ${
        input.note
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr><td bgcolor="${SURFACE}" style="border-left:3px solid ${ACCENT};border-radius:0 6px 6px 0;padding:14px 16px;"><p style="margin:0;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};">${esc(
              input.note
            )}</p></td></tr></table>`
          : ""
      }
      <p style="margin:24px 0 0;font-family:${FONT};font-size:14px;line-height:22px;color:${INK};">${esc(
        input.signoff ?? "— The UCA Sandbox team"
      )}</p>
    </td>
  </tr>
  <tr><td bgcolor="${SURFACE}" style="padding:20px 36px;border-top:1px solid ${BORDER};">${footer()(input)}</td></tr>
</table>`;
  return document(input, SURFACE, card);
}

/* ------------------------------------------------------------------ */
/* 2. SPLIT — compact header + two-column feature panel                */
/* ------------------------------------------------------------------ */
function split(input: LayoutInput) {
  const blocks = parseBody(input.body);
  const lead = blocks[0];
  const rest = blocks.slice(1);
  const [firstImage, ...otherImages] = input.images ?? [];

  const leadText = lead
    ? lead.kind === "link"
      ? `<a href="${esc(lead.url)}" target="_blank" style="color:${BRAND_1};text-decoration:underline;">${esc(
          lead.label
        )}</a>`
      : esc(lead.text)
    : "";

  const featurePanel = firstImage
    ? `<img src="${esc(firstImage)}" alt="" width="248" style="display:block;width:100%;max-width:248px;height:auto;border:0;border-radius:8px;" />`
    : `<div style="font-family:${FONT};font-size:34px;line-height:1;font-weight:700;color:${BRAND_1};">NEW</div>
       <p style="margin:10px 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">Add an image to this campaign to fill this panel.</p>`;

  const card = `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">
  <tr>
    <td bgcolor="${BRAND_1}" style="background-color:${BRAND_1};padding:18px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td valign="middle">${logo("sm")}</td>
          <td align="right" valign="middle"><span style="display:inline-block;background:${ACCENT};color:${BRAND_DEEP};font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:5px 10px;border-radius:20px;">${esc(
            input.eyebrow
          )}</span></td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="45%" valign="top" bgcolor="${SURFACE_WARM}" style="background-color:${SURFACE_WARM};border-right:1px solid ${BORDER};padding:24px;">
            ${featurePanel}
          </td>
          <td width="55%" valign="top" style="padding:24px;">
            <h1 style="margin:0 0 12px;font-family:${FONT};font-size:22px;line-height:30px;font-weight:700;color:${BRAND_1};">${esc(
              input.heading
            )}</h1>
            <p style="margin:0;font-family:${FONT};font-size:14px;line-height:22px;color:${INK};">${leadText}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:28px 36px 36px;">
      ${imagesBlock(otherImages)}
      ${paragraphs(rest)}
      ${cta(input, { variant: "filled" })}
      ${
        input.note
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr><td bgcolor="${SURFACE}" style="border-radius:6px;padding:14px 16px;"><p style="margin:0;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};">${esc(
              input.note
            )}</p></td></tr></table>`
          : ""
      }
      <p style="margin:24px 0 0;font-family:${FONT};font-size:14px;line-height:22px;color:${INK};">${esc(
        input.signoff ?? "— The UCA Sandbox team"
      )}</p>
    </td>
  </tr>
  <tr><td bgcolor="${SURFACE}" style="padding:20px 36px;border-top:1px solid ${BORDER};">${footer()(input)}</td></tr>
</table>`;
  return document(input, SURFACE, card);
}

/* ------------------------------------------------------------------ */
/* 3. TICKET — centred invitation with a dashed details stub           */
/* ------------------------------------------------------------------ */
function ticket(input: LayoutInput) {
  const blocks = parseBody(input.body);
  const card = `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:14px;overflow:hidden;">
  <tr>
    <td bgcolor="${BRAND_MID}" style="background:linear-gradient(160deg,${BRAND_1} 0%,${BRAND_DEEP} 100%);padding:36px 36px 32px;" align="center">
      ${logo("md", "center")}
      <p style="margin:18px 0 0;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${BRAND_DEEP};"><span style="display:inline-block;background:${ACCENT};padding:6px 14px;border-radius:20px;">${esc(
        input.eyebrow
      )}</span></p>
      <h1 style="margin:18px 0 0;font-family:${FONT};font-size:27px;line-height:36px;font-weight:700;color:#ffffff;text-align:center;">${esc(
        input.heading
      )}</h1>
    </td>
  </tr>
  <tr><td style="padding:0 36px;"><div style="border-top:2px dashed ${ACCENT};font-size:0;line-height:0;">&nbsp;</div></td></tr>
  <tr>
    <td style="padding:28px 36px 36px;" align="center">
      ${imagesBlock(input.images ?? [], { align: "center" })}
      ${paragraphs(blocks, { align: "center" })}
      ${
        input.note
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;"><tr><td align="center" style="border:2px dashed ${BRAND_1};border-radius:10px;padding:18px 20px;"><p style="margin:0;font-family:${FONT};font-size:14px;line-height:22px;color:${BRAND_1};font-weight:600;">${esc(
              input.note
            )}</p></td></tr></table>`
          : ""
      }
      ${cta(input, { variant: "filled", align: "center", fullWidth: true })}
      <p style="margin:24px 0 0;font-family:${FONT};font-size:13px;line-height:21px;color:${MUTED};text-align:center;font-style:italic;">${esc(
        input.signoff ?? "— The UCA Sandbox team"
      )}</p>
    </td>
  </tr>
  <tr><td bgcolor="${SURFACE}" style="padding:20px 36px;border-top:1px solid ${BORDER};">${footer({
    align: "center",
  })(input)}</td></tr>
</table>`;
  return document(input, BRAND_DEEP, card);
}

/* ------------------------------------------------------------------ */
/* 4. SPOTLIGHT — full-purple card, centred, accent CTA                */
/* ------------------------------------------------------------------ */
function spotlight(input: LayoutInput) {
  const blocks = parseBody(input.body);
  const card = `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND_1}" style="width:100%;max-width:600px;background:linear-gradient(180deg,${BRAND_1} 0%,${BRAND_DEEP} 100%);background-color:${BRAND_1};border-radius:14px;overflow:hidden;">
  <tr>
    <td style="padding:36px 36px 8px;" align="center">
      ${logo("md", "center")}
      <p style="margin:20px 0 0;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${ACCENT};">${esc(
        input.eyebrow
      )}</p>
      <div style="width:48px;height:3px;background:${ACCENT};border-radius:2px;margin:16px auto 0;font-size:0;line-height:0;">&nbsp;</div>
      <h1 style="margin:18px 0 0;font-family:${FONT};font-size:28px;line-height:37px;font-weight:700;color:#ffffff;text-align:center;">${esc(
        input.heading
      )}</h1>
    </td>
  </tr>
  <tr>
    <td style="padding:24px 36px 36px;" align="center">
      ${imagesBlock(input.images ?? [], { align: "center", radius: 10 })}
      ${paragraphs(blocks, { color: "#f0e4fa", align: "center" })}
      ${
        input.note
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;"><tr><td align="center" bgcolor="${BRAND_DEEP}" style="background-color:${BRAND_DEEP};border-radius:10px;padding:18px 20px;"><p style="margin:0;font-family:${FONT};font-size:14px;line-height:22px;color:#ffffff;">${esc(
              input.note
            )}</p></td></tr></table>`
          : ""
      }
      ${cta(input, { variant: "accent", align: "center", fullWidth: true })}
      <p style="margin:24px 0 0;font-family:${FONT};font-size:13px;line-height:21px;color:${ACCENT};text-align:center;">${esc(
        input.signoff ?? "— The UCA Sandbox team"
      )}</p>
    </td>
  </tr>
  <tr><td bgcolor="${BRAND_DEEP}" style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.15);">${footer({
    dark: true,
    align: "center",
  })(input)}</td></tr>
</table>`;
  return document(input, BRAND_DEEP, card);
}

/* ------------------------------------------------------------------ */
/* 5. NOTE — no hero, left accent rail, bullets, outlined CTA          */
/* ------------------------------------------------------------------ */
function note(input: LayoutInput) {
  const blocks = parseBody(input.body);
  const card = `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:10px;overflow:hidden;border:1px solid ${BORDER};">
  <tr>
    <td bgcolor="${BRAND_1}" style="background-color:${BRAND_1};padding:14px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="middle">${logo("sm")}</td>
        <td align="right" valign="middle"><span style="font-family:${FONT};font-size:13px;font-weight:600;color:#ffffff;">UCA Sandbox</span></td>
      </tr></table>
    </td>
  </tr>
  <tr>
    <td style="border-left:4px solid ${ACCENT};padding:28px 32px 32px;">
      <p style="margin:0 0 6px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${MUTED};">${esc(
        input.eyebrow
      )}</p>
      <h1 style="margin:0 0 18px;font-family:${FONT};font-size:22px;line-height:30px;font-weight:700;color:${BRAND_1};">${esc(
        input.heading
      )}</h1>
      ${imagesBlock(input.images ?? [], { radius: 6 })}
      ${bulletList(blocks)}
      ${
        input.note
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;"><tr><td bgcolor="${SURFACE_WARM}" style="background-color:${SURFACE_WARM};border:1px solid ${BORDER};border-radius:8px;padding:16px;"><p style="margin:0;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};"><strong style="color:${BRAND_1};">Heads up — </strong>${esc(
              input.note
            )}</p></td></tr></table>`
          : ""
      }
      ${cta(input, { variant: "outlined" })}
      <p style="margin:22px 0 0;font-family:${FONT};font-size:14px;line-height:22px;color:${INK};">${esc(
        input.signoff ?? "— The UCA Sandbox team"
      )}</p>
    </td>
  </tr>
  <tr><td bgcolor="${SURFACE_WARM}" style="padding:20px 32px;border-top:1px solid ${BORDER};">${footer()(
    input
  )}</td></tr>
</table>`;
  return document(input, SURFACE_WARM, card);
}

export const LAYOUTS: Record<LayoutKey, (input: LayoutInput) => string> = {
  BANNER: banner,
  SPLIT: split,
  TICKET: ticket,
  SPOTLIGHT: spotlight,
  NOTE: note,
};