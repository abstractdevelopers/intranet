import { Prisma } from "@prisma/client";
import { db } from "./db";
import { sendEmail } from "./email";
import { resultReportEmail, type ReportRow } from "./report-email";
import { computeAllResults } from "./results";
import { resultBand } from "./constants";
import { reserveSendSlots } from "./campaign-sender";

/**
 * Result release.
 *
 * When staff click "Release results", every student's report is generated from
 * their collated scores and emailed to their registered address. The send is
 * batched and resumable, following the repo's bulk-mail convention: a row's
 * progress is stamped BEFORE its email goes out, so a crash can skip someone
 * but can never email anyone twice.
 *
 * Results stay hidden from students until they are released — the student
 * portal reads `StudentResult.released`, which this sets.
 */

/** Batches are bounded so one request never fans out into an unbounded send. */
const CLAIM_CHUNK = 25;
const CONCURRENCY = 8;

/** Wall-clock budget for one invocation, leaving headroom under the platform cap. */
export const RELEASE_BUDGET_MS = 45_000;
export const RELEASE_INTERACTIVE_BUDGET_MS = 20_000;

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://intranet.launchverse.site").replace(/\/$/, "");
}

function reportRows(result: {
  assignmentPercent: number | null;
  theoryPercent: number | null;
  practicalPercent: number | null;
}): ReportRow[] {
  const rows: ReportRow[] = [];
  rows.push({
    label: "Assignments",
    value: result.assignmentPercent === null ? "—" : `${result.assignmentPercent}%`,
  });
  rows.push({
    label: "Theory assessment",
    value: result.theoryPercent === null ? "—" : `${result.theoryPercent}%`,
  });
  rows.push({
    label: "Practical assessment",
    value: result.practicalPercent === null ? "—" : `${result.practicalPercent}%`,
  });
  return rows;
}

/**
 * Recompute every result, then release the ones that haven't been sent yet and
 * email each student their report.
 *
 * Safe to call repeatedly: already-released rows keep their record and are
 * skipped, so a second click cannot re-email anyone. Returns progress so the UI
 * can loop until done.
 */
export async function releaseResults(options?: {
  timeBudgetMs?: number;
  /** Only release these users (used by a targeted resend). */
  userIds?: string[];
}): Promise<{ sent: number; failed: number; remaining: number; total: number; done: boolean }> {
  const startedAt = Date.now();
  const budget = options?.timeBudgetMs ?? RELEASE_BUDGET_MS;

  // Recompute first so what is released reflects the latest marks. Idempotent.
  await computeAllResults();

  const scope = options?.userIds?.length ? { userId: { in: options.userIds } } : {};
  const total = await db.studentResult.count({ where: { ...scope } });

  // Claim a chunk of results that have not been emailed, atomically, so two
  // concurrent release runs cannot both claim the same student. `FOR UPDATE
  // SKIP LOCKED` keeps them from blocking each other on the same rows.
  const claimable = await db.$queryRaw<{ id: string; userId: string }[]>`
    UPDATE "StudentResult" SET "released" = true, "releasedAt" = NOW()
    WHERE id IN (
      SELECT id FROM "StudentResult"
      WHERE "emailSentAt" IS NULL
        ${options?.userIds?.length ? Prisma.sql`AND "userId" IN (${Prisma.join(options.userIds)})` : Prisma.empty}
      ORDER BY "overallPercent" ASC
      LIMIT ${CLAIM_CHUNK}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, "userId"
  `;

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < claimable.length; i += CONCURRENCY) {
    if (Date.now() - startedAt > budget) break;
    const slice = claimable.slice(i, i + CONCURRENCY);

    await reserveSendSlots(slice.length);

    const outcomes = await Promise.all(
      slice.map(async (row) => {
        try {
          await sendResultEmail(row.id);
          return true;
        } catch (err) {
          await db.studentResult.update({
            where: { id: row.id },
            data: { emailError: err instanceof Error ? err.message.slice(0, 300) : String(err) },
          });
          return false;
        }
      })
    );
    outcomes.forEach((ok) => (ok ? (sent += 1) : (failed += 1)));
  }

  const remaining = await db.studentResult.count({
    where: { ...scope, emailSentAt: null },
  });

  return {
    sent,
    failed,
    remaining,
    total,
    done: remaining === 0,
  };
}

/**
 * Build and send one student's report. Stamps `emailSentAt` only after the
 * provider accepts it, so a failed send is retried on the next release run.
 */
export async function sendResultEmail(resultId: string) {
  const result = await db.studentResult.findUnique({
    where: { id: resultId },
    include: { user: { include: { profile: true } } },
  });
  if (!result) throw new Error("Result not found.");

  const name = result.user.profile?.fullName ?? result.user.email.split("@")[0];
  const band = result.band as ReturnType<typeof resultBand>;
  const { subject, html, text } = resultReportEmail({
    name,
    overallPercent: Math.round(result.overallPercent),
    band,
    rows: reportRows(result),
    resultsUrl: `${appUrl()}/student/results`,
  });

  await sendEmail({ to: result.user.email, subject, body: text, html });

  await db.studentResult.update({
    where: { id: resultId },
    data: { emailSentAt: new Date(), emailError: null },
  });
}
