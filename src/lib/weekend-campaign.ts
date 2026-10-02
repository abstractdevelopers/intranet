/**
 * The weekend "before Monday" push, as two separate campaigns.
 *
 * Two audiences, two different asks, so one email would serve neither:
 *   - NOT_SIGNED_UP: cannot sign in at all, so the ask is to claim the account.
 *   - SIGNED_UP: already inside, so the ask is the two setup steps (Intranet 101
 *     and the Wall).
 *
 * Styles TICKET and NOTE are the only two built-in designs not yet used in a
 * sent campaign (BANNER x8, SPOTLIGHT x1), so these read as fresh. SPLIT is
 * avoided deliberately: it reserves an image panel and renders a visible
 * placeholder when no image is attached.
 *
 * Deadlines referenced here are real constants, not copy:
 *   CLASSES_START               = 2026-10-05 (Mon)
 *   PROMISE_WALL_CLOSES         = 2026-10-03T23:59:59.999Z (Sat night)
 *   PATHWAY_AUTO_APPROVAL_UNTIL = 2026-10-04T23:59:59.999Z (Sun night — extended
 *     from 2026-10-01 so a weekend reclaim is still enrolled on the spot, which
 *     is what lets the reclaim email promise "enrolled on the spot").
 */
import { existsSync, readFileSync } from "fs";

export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://intranet.launchverse.site").replace(/\/$/, "");

export type CampaignDraft = {
  title: string;
  style: string;
  subject: string;
  eyebrow: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  note: string;
  signoff: string;
  preheader: string;
  audience: string;
};

/**
 * A — the not-signed-up reclaim push.
 *
 * TICKET, because the dashed stub suits a deadline.
 *
 * Intranet 101 is named here too, not just in the signed-up email: someone
 * reclaiming on Sunday needs to know a compulsory step is waiting on the inside,
 * so it isn't a surprise on Monday. It is framed as the important thing, not a
 * footnote.
 */
export const WEEKEND_RECLAIM: CampaignDraft = {
  title: "Weekend — reclaim before Monday locks (not signed up)",
  style: "TICKET",
  subject: "Yooooo Creators — reclaims lock Monday",
  eyebrow: "Weekend only",
  heading: "Your seat is still open — until Monday",
  body: [
    "Yooooo Creators!",
    "You signed up for UCA Sandbox and then everything went quiet on our side. That's on us. Your account has been sitting here the whole time, still holding your place.",
    "But Monday changes that. Classes begin for every pathway, and reclaims get locked. After Monday, an unclaimed account stays outside the door — no exceptions.",
    "Claiming takes a minute: set a password, pick your username, choose your pathway. You're enrolled on the spot, and you're in.",
    "Then there's the one thing waiting on the inside, and it matters more than anything else this weekend — Intranet 101. It's the compulsory intro, and your programme stays locked until you pass it. Everyone does it. Nobody skips it.",
    "Come back this weekend. Then pass Intranet 101. That's how you walk in Monday with everyone else instead of behind them.",
  ].join("\n\n"),
  ctaLabel: "Claim my account",
  ctaUrl: `${APP_URL}/forgot-password`,
  note: "Reclaims lock Monday 5 October. Intranet 101 is compulsory once you're in.",
  signoff: "— The UCA Sandbox team",
  preheader: "Reclaims lock Monday. Intranet 101 is compulsory once you're in.",
  audience: "NOT_SIGNED_UP",
};

/**
 * B — the signed-up setup push.
 *
 * NOTE, because this is a two-item checklist and that layout is built for one.
 * Intranet 101 leads, because it is the gate that actually blocks the programme.
 */
export const WEEKEND_SETUP: CampaignDraft = {
  title: "Weekend — Intranet 101 is compulsory (signed up)",
  style: "NOTE",
  subject: "The one thing that locks your programme until Monday",
  eyebrow: "Not optional",
  heading: "You're in. Now the important part.",
  body: [
    "Your account is claimed and your pathway is picked — the hard part is behind you. Two things stand between you and Monday, and the first one matters most.",
    "01 — Intranet 101. Not optional, and not something to leave until Monday. It's the compulsory intro for every creator on every pathway, and your programme stays locked until you pass it. It's short, you get two attempts, and you can do it right now.",
    "02 — The Wall. One line about what you want to make. It closes Saturday night, after which the wall becomes something you can read but never add to. That's tomorrow, not Monday.",
    "Do the first one today. Monday is not the day to be locked out of your own course.",
  ].join("\n\n"),
  ctaLabel: "Pass Intranet 101",
  ctaUrl: `${APP_URL}/student/intranet-101`,
  note: "Intranet 101 is compulsory — your programme stays locked until it's passed.",
  signoff: "— The UCA Sandbox team",
  preheader: "Intranet 101 is compulsory. Your programme stays locked until you pass.",
  audience: "SIGNED_UP",
};

export const WEEKEND_CAMPAIGNS: CampaignDraft[] = [WEEKEND_RECLAIM, WEEKEND_SETUP];

/** Addresses that must never be emailed (hard bounces + provider test inbox). */
export function loadSuppressedEmails(path = "prisma/data/reclaim-no-email.txt"): Set<string> {
  if (!existsSync(path)) return new Set();
  return new Set(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim().toLowerCase())
      .filter((l) => l.includes("@"))
  );
}

/** Signed up: has a username or completed onboarding. */
export const SIGNED_UP_WHERE = {
  role: "STUDENT" as const,
  status: "ACTIVE" as const,
  emailOptOutAt: null,
  OR: [{ username: { not: null } }, { onboardingCompletedAt: { not: null } }],
};

export const NOT_SIGNED_UP_WHERE = {
  role: "STUDENT",
  status: "ACTIVE",
  emailOptOutAt: null,
  username: null,
  onboardingCompletedAt: null,
  applications: { none: {} },
  enrollments: { none: {} },
} as const;
