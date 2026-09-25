import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOnboardedStudentApi } from "@/lib/rbac";
import { isPromiseWallOpen, PROMISE_GOAL_KEYS } from "@/lib/constants";
import { PROMISE_MAX_LENGTH, getViewerPathway } from "@/lib/promises";

export const dynamic = "force-dynamic";

const CLOSED = { error: "This warm-up closed when classes began." };

const schema = z.object({
  body: z
    .string()
    .trim()
    .min(3, "Write a little more than that.")
    .max(PROMISE_MAX_LENGTH, `Keep it to ${PROMISE_MAX_LENGTH} characters.`),
  goal: z.enum(PROMISE_GOAL_KEYS as [string, ...string[]]).optional(),
});

/** Post or update the viewer's warm-up line. */
export async function POST(request: Request) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const user = guard.user;

  if (!isPromiseWallOpen()) return NextResponse.json(CLOSED, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // The craft is derived server-side from the student's own elective, never
  // taken from the client.
  const pathway = await getViewerPathway(user.id);

  const promise = await db.promise.upsert({
    where: { userId: user.id },
    update: { body: parsed.data.body, goal: parsed.data.goal ?? null, pathway },
    create: { userId: user.id, body: parsed.data.body, goal: parsed.data.goal ?? null, pathway },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: promise.id });
}

/** Remove the viewer's line from the wall. */
export async function DELETE() {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;

  if (!isPromiseWallOpen()) return NextResponse.json(CLOSED, { status: 403 });

  await db.promise.deleteMany({ where: { userId: guard.user.id } });
  return NextResponse.json({ ok: true });
}
