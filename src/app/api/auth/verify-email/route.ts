import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { consumeEmailToken } from "@/lib/auth";

const schema = z.object({ token: z.string().min(10).max(200) });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid verification link." }, { status: 400 });
  }
  const record = await consumeEmailToken(parsed.data.token, "VERIFY_EMAIL");
  if (!record) {
    return NextResponse.json({ error: "This verification link is invalid or has expired." }, { status: 400 });
  }
  await db.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
