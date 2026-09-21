import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/campaign-sender";

/**
 * One-click unsubscribe for bulk campaigns.
 *
 * The link carries a signed token rather than a session, so a recipient can
 * opt out straight from their inbox. Only bulk campaigns honour the flag —
 * transactional mail (password resets, enrollment decisions) still sends.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  const token = body?.token;
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  const email = await verifyUnsubscribeToken(token);
  if (!email) return NextResponse.json({ error: "This link isn't valid." }, { status: 400 });

  await db.user.updateMany({
    where: { email: email.toLowerCase(), emailOptOutAt: null },
    data: { emailOptOutAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}