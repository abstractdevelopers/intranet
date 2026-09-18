import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { hashPassword } from "@/lib/auth";
import { auditLog } from "@/lib/audit";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generateTemporaryPassword(length = 12) {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(200),
  fullName: z.string().trim().min(2, "Enter the student's full name.").max(120),
});

/**
 * Create a student account with a temporary password (#1). Compulsory courses
 * are NOT auto-enrolled here — that happens when the student applies, so the
 * enrollment rules stay in one place.
 */
export async function POST(request: Request) {
  const staff = await requireStaff();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists. Issue them a temporary password instead." },
      { status: 409 }
    );
  }

  const temporaryPassword = generateTemporaryPassword();
  const user = await db.user.create({
    data: {
      email,
      passwordHash: await hashPassword(temporaryPassword),
      role: "STUDENT",
      mustChangePassword: true,
      // Issued by staff, so the address is trusted — no verification email needed.
      emailVerifiedAt: new Date(),
      profile: { create: { fullName: parsed.data.fullName } },
    },
    select: { id: true, email: true },
  });

  await auditLog({
    actorId: staff.id,
    action: "STUDENT_CREATED",
    targetType: "User",
    targetId: user.id,
    metadata: { email },
  });

  return NextResponse.json({ ok: true, id: user.id, email: user.email, temporaryPassword });
}
