import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { isStaff } from "@/lib/rbac";
import type { Role } from "@/lib/constants";

const schema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  const valid = user && (await verifyPassword(parsed.data.password, user.passwordHash));
  if (!user || !valid) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  if (user.status !== "ACTIVE") {
    return NextResponse.json({ error: "This account has been suspended." }, { status: 403 });
  }

  await createSession(user.id);
  const redirect = isStaff(user.role as Role) ? "/admin" : "/student";
  return NextResponse.json({ ok: true, redirect });
}
