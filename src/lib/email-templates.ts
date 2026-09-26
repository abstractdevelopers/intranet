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
  /** Short scannable perks, rendered as a ticked list under the paragraphs. */
  highlights?: string[];
  /** Optional sub-heading introducing the highlights. */
  highlightsLabel?: string;
  /**
   * Numbered storyboard beats, rendered in the app's editorial "01 —" pattern.
   * Used to walk through a sequence rather than list perks.
   */
  storyboard?: { title: string; body: string }[];
  /** Optional sub-heading introducing the storyboard. */
  storyboardLabel?: string;
  /** Primary call to action. */
  cta?: { label: string; url: string };
  /** Optional note rendered in a muted box under the CTA. */
  note?: string;
  /** Optional sign-off line. */
  signoff?: string;
  /** Public image URLs rendered as full-width banners below the hero. */
  images?: string[];
  /** Extra footer line, e.g. a postal address for bulk mail compliance. */
  footerNote?: string;
  /** When set, the footer carries an unsubscribe link for bulk campaigns. */
  unsubscribeUrl?: string;
  /** Preview text shown in the inbox list instead of the heading. */
  preheader?: string;
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

  const images = (options.images ?? [])
    .map(
      (url) =>
        `<img src="${esc(url)}" alt="" width="528" style="display:block;width:100%;max-width:528px;height:auto;border:0;outline:none;border-radius:8px;margin:0 0 20px;" />`
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

  const highlights =
    options.highlights && options.highlights.length
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;background-color:${SURFACE_2};border-radius:8px;">
          <tr>
            <td style="padding:18px 20px 8px;">
              ${
                options.highlightsLabel
                  ? `<p style="margin:0 0 12px;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;color:${BRAND_1};">${esc(
                      options.highlightsLabel
                    )}</p>`
                  : ""
              }
              ${options.highlights
                .map(
                  (h) =>
                    `<p style="margin:0 0 10px;font-family:${FONT};font-size:14px;line-height:22px;color:${INK};"><span style="color:${BRAND_1};font-weight:700;">&#10003;</span>&nbsp;&nbsp;${esc(
                      h
                    )}</p>`
                )
                .join("")}
            </td>
          </tr>
        </table>`
      : "";

  const storyboard =
    options.storyboard && options.storyboard.length
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 4px;">
          ${
            options.storyboardLabel
              ? `<tr><td style="padding:0 0 14px;"><p style="margin:0;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;color:${BRAND_1};">${esc(
                  options.storyboardLabel
                )}</p></td></tr>`
              : ""
          }
          ${options.storyboard
            .map((beat, i) => {
              const num = String(i + 1).padStart(2, "0");
              return `<tr>
            <td style="padding:0 0 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="46" valign="top" style="width:46px;padding:2px 0 0;">
                    <span style="font-family:${FONT};font-size:13px;font-weight:700;color:${ACCENT};">${num}</span>
                    <span style="font-family:${FONT};font-size:13px;color:${BORDER};">&#8212;</span>
                  </td>
                  <td valign="top">
                    <p style="margin:0 0 3px;font-family:${FONT};font-size:15px;line-height:22px;font-weight:600;color:${INK};">${esc(
                      beat.title
                    )}</p>
                    <p style="margin:0;font-family:${FONT};font-size:14px;line-height:22px;color:${TEXT_MUTED};">${esc(
                      beat.body
                    )}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
            })
            .join("")}
        </table>`
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

  const footerLines = [
    "UCA Sandbox — Unify Creator Academy",
    options.footerNote ?? "This message was sent to you because you have a UCA Sandbox account.",
  ];
  if (options.unsubscribeUrl) {
    footerLines.push(
      `<a href="${esc(options.unsubscribeUrl)}" target="_blank" style="color:${BRAND_1};text-decoration:underline;">Unsubscribe from academy emails</a>`
    );
  }

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
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(
    options.preheader ?? options.heading
  )}</div>
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
            ${images}
            ${paragraphs}
            ${storyboard}
            ${highlights}
            ${cta}
            ${note}
            ${signoff}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td bgcolor="${SURFACE_2}" style="padding:20px 36px;border-top:1px solid ${BORDER};">
            <p style="margin:0;font-family:${FONT};font-size:12px;line-height:20px;color:${TEXT_MUTED};">
              ${footerLines.join("<br />")}
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
    note: "This link can only be used once. It stays valid for 14 days, and if it ever expires just use “Forgot password” on the sign-in page to get a new one.",
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
    "This link can only be used once. It stays valid for 14 days, and if it ever expires use \"Forgot password\" on the sign-in page.",
    "",
    "— The UCA Sandbox team",
  ].join("\n");
  return { subject: "You're in — welcome to UCA Sandbox", html, text };
}
/**
 * Apology notice after the sign-in and password-reset outage.
 *
 * Deliberately carries no token: a bulk send must not mint one link per
 * recipient, so people are pointed at the sign-in page and asked to request
 * their own. That also keeps this email valid forever.
 */
export function passwordFixedNoticeEmail(input: { email: string; loginUrl: string; forgotUrl: string }) {
  const html = layout({
    eyebrow: "Service update",
    heading: "Password access is working again",
    paragraphs: [
      "We're sorry — and we want to be upfront about what happened.",
      "Between the point we sent your invitation and now, a fault on our side stopped password links from being accepted. Anyone who tried to set a password via an invitation link, or via \u201cForgot password\u201d, was told the link was invalid or expired. That message was wrong and it was not your fault. Your link had not expired.",
      "This affected everyone, and we are sorry for the confusion it caused.",
      "The problem is now fixed and verified end to end. If you have not yet set a password, you can do so using the link in your invitation email, or by choosing \u201cForgot password\u201d on the sign-in page.",
      "Nothing about your account or your place has changed. Your first month is still free.",
    ],
    cta: { label: "Go to sign in", url: input.loginUrl },
    note: "Prefer a fresh link? Open the sign-in page and choose \u201cForgot password\u201d, then enter this email address. You will get a new link that stays valid for one hour.",
    signoff: "\u2014 The UCA Sandbox team",
  });
  const text = [
    "Password access is working again",
    "",
    "We're sorry — and we want to be upfront about what happened.",
    "",
    "Between the point we sent your invitation and now, a fault on our side stopped password links from being accepted. Anyone who tried to set a password via an invitation link, or via \"Forgot password\", was told the link was invalid or expired. That message was wrong and it was not your fault. Your link had not expired.",
    "",
    "This affected everyone, and we are sorry for the confusion it caused.",
    "",
    "The problem is now fixed and verified end to end. If you have not yet set a password, you can do so using the link in your invitation email, or by choosing \"Forgot password\" on the sign-in page.",
    "",
    `Sign in: ${input.loginUrl}`,
    `New password: ${input.forgotUrl}`,
    "",
    "Nothing about your account or your place has changed. Your first month is still free.",
    "",
    "\u2014 The UCA Sandbox team",
  ].join("\n");
  return { subject: "Fixed: you can now set your UCA Sandbox password", html, text };
}

/**
 * Onboarding-week announcement for waiting-list accounts that have not signed
 * up yet. Carries no token (a bulk send must not mint one link per recipient),
 * so the CTA points at "Forgot password" where people request their own link.
 */
export function onboardingWeekEmail(input: { email: string; loginUrl: string; forgotUrl: string }) {
  const heading = "Onboarding week starts now — claim your seat";
  const html = layout({
    eyebrow: "Onboarding week",
    heading,
    paragraphs: [
      "The wait is over. Onboarding week at Unify Creator Academy has officially begun.",
      `You joined our waiting list, and your UCA Sandbox account is already reserved for ${input.email}. The doors are open — the only thing standing between you and your classroom is a password.`,
      "This week you'll set up your creator profile, claim your username, and lock in the elective pathway you want to specialise in. It takes about five minutes, and everything from there happens inside your own portal.",
      "Don't let this week pass you by — the people who show up now start building first.",
    ],
    cta: { label: "Claim your account", url: input.forgotUrl },
    note: `Enter this same email address (${input.email}) on that page and we'll send you a secure link to set your password. Already set one? Sign in at ${input.loginUrl}.`,
    signoff: "— The UCA Sandbox team",
  });
  const text = [
    "Onboarding week starts now — claim your seat",
    "",
    "The wait is over. Onboarding week at Unify Creator Academy has officially begun.",
    "",
    `You joined our waiting list, and your UCA Sandbox account is already reserved for ${input.email}. The doors are open — the only thing standing between you and your classroom is a password.`,
    "",
    "This week you'll set up your creator profile, claim your username, and lock in the elective pathway you want to specialise in. It takes about five minutes, and everything from there happens inside your own portal.",
    "",
    "Don't let this week pass you by — the people who show up now start building first.",
    "",
    `Claim your account: ${input.forgotUrl}`,
    `Sign in: ${input.loginUrl}`,
    "",
    `Enter this same email address (${input.email}) on that page and we'll send you a secure link to set your password.`,
    "",
    "— The UCA Sandbox team",
  ].join("\n");
  return { subject: "Onboarding week is here — claim your UCA Sandbox seat", html, text };
}

/**
 * Onboarding-week announcement for people who have ALREADY signed up. Same
 * event, different tone: they don't need to claim an account, they need to
 * finish setting it up and show up. No token — CTA goes to the sign-in page.
 */
export function onboardingWeekSignedUpEmail(input: { email: string; loginUrl: string; forgotUrl: string }) {
  const heading = "It's onboarding week — don't stop now";
  const html = layout({
    eyebrow: "Onboarding week",
    heading,
    paragraphs: [
      "Onboarding week at Unify Creator Academy is live, and you're already on the inside.",
      `You've started setting up your UCA Sandbox account for ${input.email} — which means you're ahead of the pack. The next step is finishing it.`,
      "Open your portal to complete your creator profile, claim your username, and confirm the elective pathway you're specialising in. Once that's done, your weeks unlock and the real work begins.",
      "Everyone who has their setup finished this week starts their first module on time. Give it five minutes today — future you will thank you.",
    ],
    cta: { label: "Continue in your portal", url: input.loginUrl },
    note: `Signed out or stuck on your password? Choose “Forgot password” on the sign-in page and enter ${input.email} to get a fresh link.`,
    signoff: "— The UCA Sandbox team",
  });
  const text = [
    "It's onboarding week — don't stop now",
    "",
    "Onboarding week at Unify Creator Academy is live, and you're already on the inside.",
    "",
    `You've started setting up your UCA Sandbox account for ${input.email} — which means you're ahead of the pack. The next step is finishing it.`,
    "",
    "Open your portal to complete your creator profile, claim your username, and confirm the elective pathway you're specialising in. Once that's done, your weeks unlock and the real work begins.",
    "",
    "Everyone who has their setup finished this week starts their first module on time. Give it five minutes today — future you will thank you.",
    "",
    `Continue in your portal: ${input.loginUrl}`,
    `New password: ${input.forgotUrl}`,
    "",
    `Signed out or stuck on your password? Choose "Forgot password" on the sign-in page and enter ${input.email} to get a fresh link.`,
    "",
    "— The UCA Sandbox team",
  ].join("\n");
  return { subject: "Onboarding week is live — finish your UCA Sandbox setup", html, text };
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

/**
 * Account-reclaim email.
 *
 * Sent after the account rebuild: every member gets a single-use link to set a
 * new password, then is guided through username → profile → pathway. Kept
 * short and accountable — it states plainly that access was interrupted and
 * resolved, and makes clear there is nothing to pay.
 */
export function accountReclaimEmail(input: { email: string; link: string }) {
  const html = layout({
    eyebrow: "Account restored",
    heading: "Your UCA Sandbox account is back",
    paragraphs: [
      `We've rebuilt your UCA Sandbox account for ${input.email} and restored your place at the academy.`,
      "During recent platform maintenance, sign-in was affected for all members. That was on us, it's fully resolved, and we've put safeguards in place so it can't happen again.",
      "To come back in, reclaim your account below. It takes about a minute: set a new password, choose your username, and pick your pathway.",
    ],
    highlightsLabel: "What's waiting when you're back",
    highlights: [
      "Your free month restarts the day you return — 30 days, on us.",
      "The first 100 creators back get Elite Member status: a permanent badge on your profile.",
      "Pick your pathway and get set up ahead of classes.",
      "Classes begin 5 October, so you'll be settled in before day one.",
    ],
    cta: { label: "Reclaim your account", url: input.link },
    note: "This link is single-use and stays valid for 14 days. If it expires, use “Forgot password” on the sign-in page to get a new one.",
    signoff: "— The UCA Sandbox team",
  });

  const text = [
    "Your UCA Sandbox account is back",
    "",
    `We've rebuilt your UCA Sandbox account for ${input.email} and restored your place at the academy.`,
    "",
    "During recent platform maintenance, sign-in was affected for all members. That was on us, it's fully resolved, and we've put safeguards in place so it can't happen again.",
    "",
    "To come back in, reclaim your account below. It takes about a minute: set a new password, choose your username, and pick your pathway.",
    "",
    "WHAT'S WAITING WHEN YOU'RE BACK",
    "  • Your free month restarts the day you return — 30 days, on us.",
    "  • The first 100 creators back get Elite Member status: a permanent badge on your profile.",
    "  • Pick your pathway and get set up ahead of classes.",
    "  • Classes begin 5 October, so you'll be settled in before day one.",
    "",
    `Reclaim your account: ${input.link}`,
    "",
    "This link is single-use and stays valid for 14 days. If it expires, use \"Forgot password\" on the sign-in page to get a new one.",
    "",
    "— The UCA Sandbox team",
  ].join("\n");

  return { subject: "Your UCA Sandbox account is restored — reclaim it here", html, text };
}

/**
 * The creative follow-up for accounts that still have not come back.
 *
 * Opens on a hook ("You're four clicks away"), then walks the reclaim flow as
 * a numbered storyboard in the app's own editorial "01 —" pattern, so the email
 * reads like the academy teaches rather than like a reminder.
 *
 * The beats are the real flow: set password, choose username, pick pathway,
 * start. The four pathways are named in the third beat — the 665 who have not
 * returned have none on record, so the copy lists them all and lets each
 * person recognise their own.
 *
 * No signup counts and no countdown; the only limit named is the real Elite cap.
 */
export function reclaimPressureEmail(input: { email: string; link: string }) {
  const storyboard = [
    {
      title: "Set your password",
      body: "One new password. Your old one is gone — that's the point.",
    },
    {
      title: "Claim your username",
      body: "The name your work will carry. Pick it before someone else does.",
    },
    {
      title: "Pick your pathway",
      body: "Graphics Design · Video Editing · Content Writing · Communication & Influence.",
    },
    {
      title: "Walk in",
      body: "Free month starts the day you're back. Classes begin 5 October.",
    },
  ];

  const html = layout({
    eyebrow: "Your seat is still open",
    heading: "You're four clicks away.",
    preheader: "Password. Username. Pathway. In.",
    paragraphs: [
      "Your account is rebuilt. Your seat is saved. Your pathway is still sitting there, untouched.",
      "Here's the whole thing, start to finish:",
    ],
    storyboardLabel: "The way back in",
    storyboard,
    highlightsLabel: "Waiting on the other side",
    highlights: [
      "Your free month restarts the day you're back — 30 days, on us.",
      "Elite Member status, permanent gold crest — first 100 only.",
    ],
    cta: { label: "Start step 01", url: input.link },
    note: "This link is single-use and stays valid for 14 days. If it expires, use “Forgot password” on the sign-in page to get a new one.",
    signoff: "— The UCA Sandbox team",
  });

  const text = [
    "You're four clicks away.",
    "",
    "Your account is rebuilt. Your seat is saved. Your pathway is still sitting there, untouched.",
    "",
    "Here's the whole thing, start to finish:",
    "",
    "THE WAY BACK IN",
    ...storyboard.flatMap((b, i) => [
      `  ${String(i + 1).padStart(2, "0")} — ${b.title}`,
      `       ${b.body}`,
      "",
    ]),
    "WAITING ON THE OTHER SIDE",
    "  • Your free month restarts the day you're back — 30 days, on us.",
    "  • Elite Member status, permanent gold crest — first 100 only.",
    "",
    `Start step 01: ${input.link}`,
    "",
    "This link is single-use and stays valid for 14 days. If it expires, use \"Forgot password\" on the sign-in page to get a new one.",
    "",
    "— The UCA Sandbox team",
  ].join("\n");

  return { subject: "You're four clicks away.", html, text };
}
