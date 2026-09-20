import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { sendWelcomeEmail } from "@/lib/welcome";
import type { Prisma } from "@prisma/client";

/** Waiting-list accounts: no username, no onboarding, no application yet. */
const WAITING_LIST_ONLY: Prisma.UserWhereInput = {
  username: null,
  onboardingCompletedAt: null,
  applications: { none: {} },
  enrollments: { none: {} },
};

// Bounded so one request cannot fan out into an unbounded send loop.
const MAX_BATCH = 25;
const CHUNK = 5;

const schema = z.object({
  /** Specific accounts to invite; defaults to the whole waiting list. */
  userIds: z.array(z.string().min(1)).max(MAX_BATCH).optional(),
  /** Re-invite people who were already emailed. Off by default. */
  resend: z.boolean().optional(),
});

/**
 * Invite waiting-list accounts to claim their access.
 *
 * One email per person, since each link is single-use. Sends are chunked to
 * stay inside the provider's rate limit, and each account is stamped before
 * sending so a double-click or retry cannot email the same person twice.
 */
export async function POST(request: Request) {
  const staff = await requireStaff();
  const parsed = schema.safeParse((await request.json().catch(() => null)) ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const students = await db.user.findMany({
    where: {
      role: "STUDENT",
      status: "ACTIVE",
      ...WAITING_LIST_ONLY,
      ...(parsed.data.resend ? {} : { welcomeEmailSentAt: null }),
      ...(parsed.data.userIds?.length ? { id: { in: parsed.data.userIds } } : {}),
    },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
    take: MAX_BATCH,
  });

  if (students.length === 0) {
    const remaining = await db.user.count({
      where: {
        role: "STUDENT",
        status: "ACTIVE",
        ...WAITING_LIST_ONLY,
        ...(parsed.data.resend ? {} : { welcomeEmailSentAt: null }),
      },
    });
    return NextResponse.json({ ok: true, sent: 0, failed: 0, remaining });
  }

  // Stamp first: a crash mid-send may skip an email, but it can never duplicate one.
  await db.user.updateMany({
    where: { id: { in: students.map((s) => s.id) } },
    data: { welcomeEmailSentAt: new Date() },
  });

  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < students.length; i += CHUNK) {
    const results = await Promise.all(
      students.slice(i, i + CHUNK).map(async (s) => {
        try {
          await sendWelcomeEmail({ email: s.email, userId: s.id, origin });
          return true;
        } catch {
          return false;
        }
      })
    );
    results.forEach((ok) => (ok ? (sent += 1) : (failed += 1)));
  }

  await auditLog({
    actorId: staff.id,
    action: "WELCOME_EMAILS_SENT",
    targetType: "User",
    metadata: { sent, failed, resend: Boolean(parsed.data.resend) },
  });

  const remaining = await db.user.count({
    where: {
      role: "STUDENT",
      status: "ACTIVE",
      ...WAITING_LIST_ONLY,
      ...(parsed.data.resend ? {} : { welcomeEmailSentAt: null }),
    },
  });

  return NextResponse.json({ ok: true, sent, failed, remaining });
}