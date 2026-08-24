import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createEmailToken } from "@/lib/auth";

const schema = z.object({ email: z.string().trim().email().max(200) });

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
    console.log(`[uca] password reset link for ${user.email}: /reset-password?token=${token}`);
  }
  return NextResponse.json({ ok: true });
}
