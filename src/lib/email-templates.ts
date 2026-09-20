/**
 * Branded HTML email templates.
 *
 * Uses table-based layout and inline styles because email clients strip
 * <style> blocks and don't support flex or grid. Colours match the portal
 * theme in globals.css, and the logo is the same white monogram the app uses
 * — white, so it must sit on the purple band, never on a light background.
 */

const BRAND_1 = "#570e83"; // primary purple
const BRAND_2 = "#410b61"; // deep purple
const INK = "#0d070b";
const SURFACE = "#ffffff";
const SURFACE_2 = "#f4f0f7";
const BORDER = "#e7e0ec";
const TEXT_MUTED = "#6b6470";
const ACCENT = "#e6a9ff";
const FONT = "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const EMAIL_LOGO_URL =
  process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/uca-logo.png`
    : "https://intranet.launchverse.site/uca-logo.png";

/** Escape user-supplied text before it goes into HTML. */
function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type LayoutOptions = {
  /** Small uppercase label above the headline, matching the app's .eyebrow. */
  eyebrow: string;
  heading: string;
  /** Paragraphs of body copy. Plain text, escaped before rendering. */
  paragraphs: string[];
  /** Primary call to action. */
  cta?: { label: string; url: string };
  /** Optional note rendered in a muted box under the CTA. */
  note?: string;
  /** Optional sign-off line. */
  signoff?: string;
};

/**
 * Shared shell: purple gradient hero with the white monogram, a white body
 * card, then a quiet footer. Width is fixed at 600px because Outlook has no
 * reliable max-width support on nested tables.
 */
function layout(options: LayoutOptions) {
  const paragraphs = options.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:24px;color:${INK};">${esc(p)}</p>`
    )
    .join("");

  const cta = options.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 4px;">
          <tr>
            <td align="center" bgcolor="${BRAND_1}" style="border-radius:8px;">
              <a href="${options.cta.url}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${esc(
                options.cta.label
              )}</a>
            </td>
          </tr>
        </table>
        <p style="margin:12px 0 0;font-family:${FONT};font-size:12px;line-height:20px;color:${TEXT_MUTED};word-break:break-all;">
          If the button doesn't work, paste this into your browser:<br />
          <a href="${options.cta.url}" target="_blank" style="color:${BRAND_1};text-decoration:underline;">${esc(
            options.cta.url
          )}</a>
        </p>`
    : "";

  const note = options.note
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
          <tr>
            <td bgcolor="${SURFACE_2}" style="border-left:3px solid ${ACCENT};border-radius:0 6px 6px 0;padding:14px 16px;">
              <p style="margin:0;font-family:${FONT};font-size:13px;line-height:20px;color:${TEXT_MUTED};">${esc(
                options.note
              )}</p>
            </td>
          </tr>
        </table>`
    : "";

  const signoff = options.signoff
    ? `<p style="margin:24px 0 0;font-family:${FONT};font-size:14px;line-height:22px;color:${INK};">${esc(
        options.signoff
      )}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${esc(options.heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:${SURFACE_2};">
<!-- Preview text, hidden in the body but shown in the inbox list. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(options.heading)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${SURFACE_2};padding:32px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:${SURFACE};border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">

        <!-- Purple hero band, mirrors .hero-band in the app -->
        <tr>
          <td bgcolor="${BRAND_1}" style="background:linear-gradient(135deg,${BRAND_1} 0%,${BRAND_2} 55%,#2d0745 100%);padding:32px 36px 28px;">
            <img src="${EMAIL_LOGO_URL}" alt="UCA" width="64" height="40" style="display:block;border:0;outline:none;width:64px;height:auto;" />
            <p style="margin:20px 0 0;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${ACCENT};">${esc(
              options.eyebrow
            )}</p>
            <h1 style="margin:8px 0 0;font-family:${FONT};font-size:24px;line-height:32px;font-weight:700;color:#ffffff;">${esc(
              options.heading
            )}</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px 36px;">
            ${paragraphs}
            ${cta}
            ${note}
            ${signoff}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td bgcolor="${SURFACE_2}" style="padding:20px 36px;border-top:1px solid ${BORDER};">
            <p style="margin:0;font-family:${FONT};font-size:12px;line-height:20px;color:${TEXT_MUTED};">
              UCA Sandbox — Unify Creator Academy<br />
              This message was sent to you because you have a UCA Sandbox account.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Password reset email. */
export function passwordResetEmail(input: { link: string }) {
  const html = layout({
    eyebrow: "Account security",
    heading: "Reset your password",
    paragraphs: [
      "We received a request to reset the password for your UCA Sandbox account.",
      "Choose a new password using the button below. This link can only be used once, and it expires in one hour.",
    ],
    cta: { label: "Set a new password", url: input.link },
    note: "If you didn't request this, you can safely ignore this email — your password won't change until the link above is used.",
    signoff: "— The UCA Sandbox team",
  });
  const text = [
    "Reset your UCA Sandbox password",
    "",
    "We received a request to reset the password for your UCA Sandbox account.",
    "",
    `Set a new password here: ${input.link}`,
    "",
    "This link can only be used once and expires in one hour.",
    "If you didn't request this, you can safely ignore this email.",
    "",
    "— The UCA Sandbox team",
  ].join("\n");
  return { subject: "Reset your UCA Sandbox password", html, text };
}

/** Welcome email for a newly provisioned account. */
export function welcomeEmail(input: { email: string; link: string }) {
  const html = layout({
    eyebrow: "You're in",
    heading: "Welcome to UCA Sandbox",
    paragraphs: [
      `You're on the list — your UCA Sandbox account is ready for ${input.email}.`,
      "UCA Sandbox is the online campus for Unify Creator Academy. You'll take two compulsory foundations — Personal Branding and Social Media — plus the one elective pathway you chose. Your first month is free.",
      "To get started, set your password using the button below. You'll then choose a username and complete your profile.",
    ],
    cta: { label: "Set your password", url: input.link },
    note: "For your security, this link can only be used once and expires in one hour. If it expires, just use “Forgot password” on the sign-in page to get a new one.",
    signoff: "— The UCA Sandbox team",
  });
  const text = [
    "Welcome to UCA Sandbox",
    "",
    `You're on the list — your UCA Sandbox account is ready for ${input.email}.`,
    "",
    "UCA Sandbox is the online campus for Unify Creator Academy. You'll take two compulsory foundations — Personal Branding and Social Media — plus the one elective pathway you chose. Your first month is free.",
    "",
    `Set your password here: ${input.link}`,
    "",
    "This link can only be used once and expires in one hour.",
    "",
    "— The UCA Sandbox team",
  ].join("\n");
  return { subject: "You're in — welcome to UCA Sandbox", html, text };
}

/** Wrap plain notification text in the branded shell. */
export function notificationEmail(input: { title: string; body: string; link?: string }) {
  const html = layout({
    eyebrow: "UCA Sandbox",
    heading: input.title,
    paragraphs: [input.body],
    cta: input.link ? { label: "Open UCA Sandbox", url: input.link } : undefined,
  });
  return { subject: input.title, html, text: `${input.title}\n\n${input.body}` };
}