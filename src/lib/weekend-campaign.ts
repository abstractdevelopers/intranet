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
 *   CLASSES_START          = 2026-10-05
 *   PROMISE_WALL_CLOSES    = 2026-10-03T23:59:59.999Z
 *   PATHWAY_AUTO_APPROVAL_UNTIL = 2026-10-01T23:59:59.999Z (already lapsed)
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
 */
export const WEEKEND_RECLAIM: CampaignDraft = {
  title: "Weekend — claim your account (not signed up)",
  style: "TICKET",
  subject: "Your account is still yours — until Monday",
  eyebrow: "Weekend only",
  heading: "Your account is still yours — until Monday",
  body: [
    "Yooooo Creators!",
    "You signed up for UCA Sandbox and then everything went quiet on our side. That's on us. But your account has been sitting here the whole time, and it still has your name on it.",
    "Here's the thing about Monday: classes begin for every pathway. From Monday, the only way into the intranet is an account you've already claimed — unclaimed accounts stay outside the door.",
    "Claiming takes about a minute. Set a password, pick your username, choose your pathway. Then you're inside, ahead of everyone still thinking about it.",
    "One change since Thursday: pathways are no longer auto-approved. Pick yours this weekend and staff review it, so you can still be settled before Monday rather than catching up after.",
  ].join("\n\n"),
  ctaLabel: "Claim my account",
  ctaUrl: `${APP_URL}/forgot-password`,
  note: "Claim before Monday 5 October to start with your class.",
  signoff: "— The UCA Sandbox team",
  preheader: "Classes begin Monday. Claim your account before the doors close.",
  audience: "NOT_SIGNED_UP",
};

/**
 * B — the signed-up setup push.
 *
 * NOTE, because this is a two-item checklist and that layout is built for one.
 */
export const WEEKEND_SETUP: CampaignDraft = {
  title: "Weekend — two things left (signed up)",
  style: "NOTE",
  subject: "Two things before Monday (you're almost there)",
  eyebrow: "Almost Monday",
  heading: "You're in. Two things left.",
  body: [
    "You've already done the hard part — your account is claimed and your pathway is picked. Two things to close out before Monday.",
    "01 — Intranet 101. Seven questions, 70% to pass, two attempts. It's the compulsory intro and it unlocks the rest of your programme. About ten minutes, and you can retake it once if you need to.",
    "02 — The Wall. One line about what you want to make. It closes Saturday night, after which the wall becomes an archive you can read but not add to. That's tomorrow, not Monday.",
    "Worth knowing: 37 of your coursemates have already passed the intro, and 17 have put their line on the wall. You're not early — you're right on time.",
    "Then it's Monday, and we get to work.",
  ].join("\n\n"),
  ctaLabel: "Finish my setup",
  ctaUrl: `${APP_URL}/student`,
  note: "Intranet 101 is compulsory — your programme stays locked until it's passed.",
  signoff: "— The UCA Sandbox team",
  preheader: "Intranet 101 and your Wall line — both before Monday.",
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
