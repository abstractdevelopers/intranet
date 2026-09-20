import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createEmailToken } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { passwordResetEmail } from "@/lib/email-templates";

const schema = z.object({ email: z.string().trim().email().max(200) });

/**
 * Absolute origin for links in outbound email. Prefers an explicit
 * NEXT_PUBLIC_APP_URL (needed when the request host is a preview URL) and
 * falls back to the origin that served the request.
 */
function appOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  // Always return ok to avoid leaking which emails exist.
  if (user) {
    const token = await createEmailToken(user.id, "PASSWORD_RESET");
    const link = `${appOrigin(request)}/reset-password?token=${token}`;

    const { subject, html, text } = passwordResetEmail({ link });
    await sendEmail({ to: user.email, subject, body: text, html });

    // Without a mail provider configured the link only exists here, so surface
    // it in the logs rather than leaving the reset flow silently broken.
    if (!process.env.SENDBYTE_API_KEY) {
      console.info(`[uca] password reset link for ${user.email}: ${link}`);
    }
  }
  return NextResponse.json({ ok: true });
}
