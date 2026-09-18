import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/rbac";
import { hashPassword, verifyPassword, revokeSessions, createSession } from "@/lib/auth";
import { auditLog } from "@/lib/audit";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters.").max(200),
});

/** Replace the temporary password with a permanent one (#1). */
export async function POST(request: Request) {
  const user = await requireStudent();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const record = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const valid = await verifyPassword(parsed.data.currentPassword, record.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "That temporary password isn't correct." }, { status: 401 });
  }
  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return NextResponse.json(
      { error: "Choose a password different from your temporary one." },
      { status: 400 }
    );
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.newPassword),
      mustChangePassword: false,
    },
  });

  // Every other session from the temporary password is no longer trustworthy.
  await revokeSessions(user.id);
  await createSession(user.id);
  await auditLog({ actorId: user.id, action: "PASSWORD_SET_ONBOARDING", targetType: "User", targetId: user.id });

  return NextResponse.json({ ok: true, redirect: "/onboarding/username" });
}
