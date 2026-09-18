import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/rbac";
import { normaliseUsername, validateUsername } from "@/lib/auth";
import { auditLog } from "@/lib/audit";

/** Availability check for the username picker. */
export async function GET(request: Request) {
  await requireStudent();
  const username = normaliseUsername(new URL(request.url).searchParams.get("username") ?? "");

  const invalid = validateUsername(username);
  if (invalid) return NextResponse.json({ available: false, error: invalid });

  const taken = await db.user.findUnique({ where: { username }, select: { id: true } });
  if (taken) return NextResponse.json({ available: false, error: "That username is already taken." });

  return NextResponse.json({ available: true });
}

const schema = z.object({ username: z.string().min(1).max(40) });

/** Claim the public username (#1). */
export async function POST(request: Request) {
  const user = await requireStudent();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a username." }, { status: 400 });

  const username = normaliseUsername(parsed.data.username);
  const invalid = validateUsername(username);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  // A student may set their username once during setup; later changes go through
  // the profile page, which enforces the cooldown.
  if (user.username && user.onboardingCompletedAt) {
    return NextResponse.json(
      { error: "Your username is already set. Change it from your profile page." },
      { status: 409 }
    );
  }

  const taken = await db.user.findUnique({ where: { username }, select: { id: true } });
  if (taken && taken.id !== user.id) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }

  // The first pick isn't a "change", so it doesn't start the cooldown clock —
  // otherwise a typo during setup would lock the student out of fixing it.
  await db.user.update({
    where: { id: user.id },
    data: { username },
  });
  await auditLog({
    actorId: user.id,
    action: "USERNAME_SET",
    targetType: "User",
    targetId: user.id,
    metadata: { username },
  });

  return NextResponse.json({ ok: true, redirect: "/onboarding/profile" });
}
