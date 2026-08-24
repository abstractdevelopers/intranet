/**
 * Email delivery for notifications.
 *
 * Provider: Resend (https://resend.com) via its REST API — no SDK needed.
 * When RESEND_API_KEY isn't configured, emails are logged server-side and
 * delivery is skipped; in-app notifications always work regardless.
 * Swap `sendEmail` to change providers without touching call sites.
 */
export async function sendEmail(input: { to: string; subject: string; body: string }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "UCA Sandbox <no-reply@uca.sandbox>";
  if (!key) {
    console.info(`[email:skipped] ${input.subject} → ${input.to}`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        text: input.body,
      }),
    });
    if (!res.ok) console.error("[email:failed]", res.status, await res.text());
  } catch (err) {
    // Email must never break the request that triggered it.
    console.error("[email:failed]", err);
  }
}
