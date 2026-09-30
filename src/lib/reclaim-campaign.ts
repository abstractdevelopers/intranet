/**
 * The approved "reclaim your account" campaign copy.
 *
 * Kept in src/lib rather than in a script so the send script and any future
 * preview can import it without running a script's main(). A script that seeds
 * on import cannot be imported safely — see the note on seed-intranet-101.
 *
 * Style is SPOTLIGHT, not SPLIT: SPLIT reserves an image panel and renders a
 * visible placeholder ("Add an image to this campaign to fill this panel") when
 * no image is attached, which would ship to recipients. SPOTLIGHT needs none.
 */
import { existsSync, readFileSync } from "fs";

export const RECLAIM_AUDIENCE = "NOT_SIGNED_UP";

export const RECLAIM_CAMPAIGN = {
  title: "Reclaim — you didn't quit, you got busy",
  style: "SPOTLIGHT",
  subject: "You didn't quit. You got busy.",
  eyebrow: "No judgement here",
  heading: "You didn't quit. You got busy.",
  body: [
    "Signing up was the easy part. Then life got loud, and the thing you were waiting for wasn't ready yet. That part is on us.",
    "It's ready now. Four crafts, live classes, and a studio where your work actually lives — not a folder on your laptop nobody sees.",
    "Graphics Design. Video Editing. Communication & Influence. Content Writing. Pick the one you keep coming back to.",
    "Classes start Monday 5 October. Your free month hasn't been ticking this whole time — it starts the day you walk back in.",
  ].join("\n\n"),
  ctaLabel: "Finish what you started",
  note: "₦15,000/month per course after your free month. Nothing today.",
  signoff: "— The UCA Sandbox team",
  preheader: "Your UCA Sandbox account is still yours. Come take it back.",
} as const;

/**
 * Addresses that must never be emailed: the hard bounces in the SendByte log plus
 * the provider test inbox. Accounts still exist for real people (they can use
 * "forgot password"); this only suppresses the outbound email.
 */
export function loadSuppressedEmails(path = "prisma/data/reclaim-no-email.txt"): Set<string> {
  if (!existsSync(path)) return new Set();
  return new Set(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim().toLowerCase())
      .filter((l) => l.includes("@"))
  );
}

/** The NOT_SIGNED_UP predicate: signed up for nothing yet — no username, no
 * onboarding, no application, no enrollment. Mirrors the admin filter and the
 * NOT_SIGNED_UP audience in campaign-sender. */
export const NOT_SIGNED_UP_WHERE = {
  role: "STUDENT",
  status: "ACTIVE",
  emailOptOutAt: null,
  username: null,
  onboardingCompletedAt: null,
  applications: { none: {} },
  enrollments: { none: {} },
} as const;
