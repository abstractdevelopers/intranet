import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOnboardedStudentApi } from "@/lib/rbac";
import { auditLog, notify } from "@/lib/audit";
import { getCurrentWeek, parseResponses, validateResponses } from "@/lib/captains-log";
import { getModuleAccess } from "@/lib/module-access";

export const dynamic = "force-dynamic";

/**
 * Submit the Captain's Log for the current week (#12). Submitting is recorded
 * once per week — re-submitting updates the existing entry rather than
 * creating duplicates, since students often refine answers before the lock.
 */
export async function POST(request: Request) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const user = guard.user;

  const body = await request.json().catch(() => null);
  const weekNumberRaw = (body as { weekNumber?: unknown } | null)?.weekNumber;
  const requestedWeek = Number(weekNumberRaw);

  const currentWeek = await getCurrentWeek(user.id);
  if (currentWeek === null) {
    return NextResponse.json(
      { error: "Your Captain's Log opens once your first week is released." },
      { status: 409 }
    );
  }

  // A student may only log the week they are actually on: never a week ahead.
  const weekNumber = Number.isFinite(requestedWeek) && requestedWeek > 0 ? requestedWeek : currentWeek;
  if (weekNumber > currentWeek) {
    return NextResponse.json(
      { error: "That week hasn't been released yet." },
      { status: 409 }
    );
  }

  const validated = validateResponses((body as { responses?: unknown } | null)?.responses);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  const existing = await db.captainLog.findUnique({
    where: { userId_weekNumber: { userId: user.id, weekNumber } },
  });

  // Once staff have reviewed a log, the answers are part of the record and
  // must not change under the reviewer. Further edits would silently detach
  // the review note from the content it was written about.
  if (existing && existing.status === "REVIEWED") {
    return NextResponse.json(
      { error: "This week's log has already been reviewed and can no longer be edited." },
      { status: 409 }
    );
  }

  const log = existing
    ? await db.captainLog.update({
        where: { id: existing.id },
        data: { responses: JSON.stringify(validated.responses), submittedAt: new Date() },
      })
    : await db.captainLog.create({
        data: {
          userId: user.id,
          weekNumber,
          responses: JSON.stringify(validated.responses),
        },
      });

  await auditLog({
    actorId: user.id,
    action: existing ? "CAPTAIN_LOG_UPDATED" : "CAPTAIN_LOG_SUBMITTED",
    targetType: "CaptainLog",
    targetId: log.id,
    metadata: { weekNumber },
  });

  // Submitting can release the next week, so tell the student what opened up.
  const enrollments = await db.enrollment.findMany({
    where: { userId: user.id, status: "ACCEPTED" },
    select: { courseId: true },
  });
  let unlockedNext = false;
  for (const enrollment of enrollments) {
    const access = await getModuleAccess(user.id, enrollment.courseId);
    if (access.some((m) => m.weekNumber === weekNumber + 1 && m.unlocked)) {
      unlockedNext = true;
      break;
    }
  }

  if (unlockedNext) {
    await notify({
      userId: user.id,
      type: "WEEK_UNLOCKED",
      title: "New week unlocked",
      body: `Thanks for your Captain's Log for Week ${weekNumber}. Week ${weekNumber + 1} is now available.`,
    });
  }

  // Let reviewers know a log is waiting.
  const staff = await db.user.findMany({
    where: { role: { in: ["FOUNDER", "SUPER_ADMIN", "ACADEMY_ADMIN", "INSTRUCTOR", "REVIEWER"] } },
    select: { id: true },
  });
  await Promise.all(
    staff.map((s) =>
      notify({
        userId: s.id,
        type: "CAPTAIN_LOG_SUBMITTED",
        title: `Captain's Log submitted — Week ${weekNumber}`,
        body: `${user.fullName} completed their Week ${weekNumber} reflection.`,
      })
    )
  );

  return NextResponse.json({ ok: true, id: log.id, unlockedNext });
}

/** The student's own log history, used by the progress record (#18). */
export async function GET() {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const user = guard.user;
  const logs = await db.captainLog.findMany({
    where: { userId: user.id },
    orderBy: { weekNumber: "desc" },
  });
  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      weekNumber: l.weekNumber,
      status: l.status,
      submittedAt: l.submittedAt,
      responses: parseResponses(l.responses),
    })),
  });
}
