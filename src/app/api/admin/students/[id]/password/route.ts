import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { hashPassword, revokeSessions } from "@/lib/auth";
import { auditLog, notify } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Ambiguous characters (0/O, 1/l/I) are left out — these get read aloud and copied by hand.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generateTemporaryPassword(length = 12) {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/**
 * Issue (or re-issue) a student's temporary password (#1). The student is
 * forced to change it on next login; returning it here is deliberate — the
 * academy hands credentials over out of band until an email provider is added.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;

  const student = await db.user.findFirst({
    where: { id, role: "STUDENT" },
    select: { id: true, email: true, mustChangePassword: true },
  });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const temporaryPassword = generateTemporaryPassword();

  await db.user.update({
    where: { id },
    data: {
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
      // Reset the onboarding gate so they walk through setup again.
      onboardingCompletedAt: null,
    },
  });

  // Any session on the old password is no longer valid.
  await revokeSessions(id);

  await notify({
    userId: id,
    type: "ACCOUNT_CREDENTIALS_ISSUED",
    title: "New temporary password issued",
    body: "Your academy password was reset. Sign in and set a new password.",
  });

  await auditLog({
    actorId: staff.id,
    action: "STUDENT_TEMP_PASSWORD_ISSUED",
    targetType: "User",
    targetId: id,
    metadata: { reissued: student.mustChangePassword },
  });

  // Never log or store the plaintext beyond this response.
  return NextResponse.json({ ok: true, email: student.email, temporaryPassword });
}
