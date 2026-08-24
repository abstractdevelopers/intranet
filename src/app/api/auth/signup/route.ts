import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createEmailToken, createSession, hashPassword } from "@/lib/auth";

const schema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name.").max(120),
  email: z.string().trim().email("Please enter a valid email address.").max(200),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const user = await db.user.create({
    data: {
      email,
      passwordHash: await hashPassword(parsed.data.password),
      role: "STUDENT",
      profile: { create: { fullName: parsed.data.fullName } },
    },
  });

  const token = await createEmailToken(user.id, "VERIFY_EMAIL");
  // Email delivery plugs in here. In development the link is logged server-side.
  console.log(`[uca] verification link for ${email}: /verify-email?token=${token}`);

  await createSession(user.id);
  return NextResponse.json({ ok: true, redirect: "/verify-email" });
}
