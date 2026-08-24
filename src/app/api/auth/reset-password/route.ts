import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { consumeEmailToken, hashPassword } from "@/lib/auth";

const schema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }
  const record = await consumeEmailToken(parsed.data.token, "PASSWORD_RESET");
  if (!record) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }
  await db.user.update({
    where: { id: record.userId },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });
  // Invalidate all existing sessions after a password change.
  await db.session.deleteMany({ where: { userId: record.userId } });
  return NextResponse.json({ ok: true });
}
