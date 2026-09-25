import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOnboardedStudentApi } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Shape of a PushSubscription.toJSON() payload from the browser. */
const schema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
});

/**
 * Register a browser/device for push. Keyed by endpoint so re-subscribing on
 * the same device updates rather than duplicates, and one student can have
 * several devices.
 */
export async function POST(request: Request) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const user = guard.user;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  }
  const { endpoint, keys } = parsed.data;

  await db.pushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userId: user.id,
      userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
    // A second student on a shared browser replaces ownership of the endpoint.
    update: {
      userId: user.id,
      p256dh: keys.p256dh,
      auth: keys.auth,
      lastSeenAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

/** Remove a subscription — called when the student turns notifications off. */
export async function DELETE(request: Request) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const user = guard.user;

  const parsed = z
    .object({ endpoint: z.string().url().max(1000) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Scoped to the caller so one student can't unsubscribe another's device.
  await db.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, userId: user.id },
  });

  return NextResponse.json({ ok: true });
}
