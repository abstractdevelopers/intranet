import { createEmailToken } from "./auth";
import { sendEmail } from "./email";
import { welcomeEmail } from "./email-templates";

/** Welcome invites are handed out in bulk, so give them room to be opened later. */
export const WELCOME_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

/**
 * Build the welcome link for an account. Kept separate from sending so callers
 * can preview a link without dispatching mail.
 */
export async function buildWelcomeLink(userId: string, origin: string) {
  const token = await createEmailToken(userId, "PASSWORD_RESET", WELCOME_TOKEN_TTL_MS);
  return `${origin.replace(/\/$/, "")}/reset-password?token=${token}`;
}

/**
 * Email a new account holder their invitation.
 *
 * Uses the password-reset token type deliberately: the landing page is the
 * same, and `reset-password` clears `mustChangePassword`, so a single flow
 * covers both "welcome" and "I forgot my password".
 */
export async function sendWelcomeEmail(input: {
  email: string;
  userId: string;
  origin: string;
}) {
  const link = await buildWelcomeLink(input.userId, input.origin);
  const { subject, html, text } = welcomeEmail({ email: input.email, link });
  await sendEmail({ to: input.email, subject, body: text, html });
  return { link };
}