/**
 * Audience targeting and background delivery for email campaigns.
 *
 * Sending is batched and resumable: each recipient gets a row before any email
 * goes out, and rows are claimed in chunks. A run that dies mid-way resumes
 * from where it stopped. Consistent with the repo's bulk-mail convention, a
 * crash can skip someone but can never email anyone twice — a claimed row is
 * marked before the provider is called.
 */

import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";
import type { Prisma } from "@prisma/client";

export type AudienceKind =
  | "ALL_STUDENTS"
  | "SIGNED_UP"
  | "SIGNED_UP_NO_COURSE"
  | "ELECTIVE"
  | "NOT_SIGNED_UP"
  | "COURSE"
  | "PATHWAY";

export type AudienceRules = {
  audience: AudienceKind;
  courseIds?: string[];
  pathway?: string | null;
};

/** Waiting-list accounts that never began onboarding. Mirrors the admin filters. */
const NOT_SIGNED_UP: Prisma.UserWhereInput = {
  username: null,
  onboardingCompletedAt: null,
  applications: { none: {} },
  enrollments: { none: {} },
};

const SIGNED_UP: Prisma.UserWhereInput = {
  OR: [
    { username: { not: null } },
    { onboardingCompletedAt: { not: null } },
    { applications: { some: {} } },
    { enrollments: { some: {} } },
  ],
};

/**
 * Signed up but has no course yet — finished onboarding (or picked a username)
 * without applying, so nothing is enrolled. This is the "signed up and hasn't
 * chosen a course" audience the academy nudges to complete their application.
 */
const SIGNED_UP_NO_COURSE: Prisma.UserWhereInput = {
  OR: [{ username: { not: null } }, { onboardingCompletedAt: { not: null } }],
  applications: { none: {} },
  enrollments: { none: {} },
};

/** Includes students with any elective enrolment at all, whatever its status. */
const ELECTIVE: Prisma.UserWhereInput = {
  enrollments: { some: { enrollmentType: "ELECTIVE" } },
};

/** Recognised audience kinds, used for validation and parsing. */
export const AUDIENCE_KINDS: AudienceKind[] = [
  "ALL_STUDENTS",
  "SIGNED_UP",
  "SIGNED_UP_NO_COURSE",
  "ELECTIVE",
  "NOT_SIGNED_UP",
  "COURSE",
  "PATHWAY",
];

/** Reasonable upper bound so a stray rule can't target the wrong population. */
export function parseAudience(raw: string): AudienceRules {
  try {
    const parsed = JSON.parse(raw) as AudienceRules;
    if (parsed && AUDIENCE_KINDS.includes(parsed.audience)) {
      return parsed;
    }
  } catch {
    /* fall through to the default */
  }
  return { audience: "ALL_STUDENTS" };
}

/**
 * Resolve audience rules to a recipient list. People who opted out of bulk
 * email are always excluded, and suspended accounts are skipped.
 */
export async function resolveAudience(rules: AudienceRules) {
  return db.user.findMany({
    where: {
      AND: [{ role: "STUDENT", status: "ACTIVE", emailOptOutAt: null }, audienceWhere(rules)],
    },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * The push-audience variant of resolveAudience: same categories, but no email
 * opt-out (push is opted into by subscribing the device) and suspended
 * accounts still excluded.
 */
export async function resolveAudienceForPush(rules: AudienceRules) {
  return db.user.findMany({
    where: { AND: [{ role: "STUDENT", status: "ACTIVE" }, audienceWhere(rules)] },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Shared audience predicate, reused by email and push resolution. */
function audienceWhere(rules: AudienceRules): Prisma.UserWhereInput {
  switch (rules.audience) {
    case "SIGNED_UP":
      return SIGNED_UP;
    case "SIGNED_UP_NO_COURSE":
      return SIGNED_UP_NO_COURSE;
    case "ELECTIVE":
      return ELECTIVE;
    case "NOT_SIGNED_UP":
      return NOT_SIGNED_UP;
    case "COURSE":
      return { enrollments: { some: { courseId: { in: rules.courseIds ?? [] } } } };
    case "PATHWAY":
      // Applications record the chosen elective as a course, so the pathway is
      // read through that relation rather than stored on the application itself.
      return {
        OR: [
          { enrollments: { some: { pathway: rules.pathway ?? undefined } } },
          { applications: { some: { selectedElective: { pathway: rules.pathway ?? undefined } } } },
        ],
      };
    default:
      return {};
  }
}

export function describeAudience(rules: AudienceRules, courseNames: string[] = []): string {
  switch (rules.audience) {
    case "SIGNED_UP":
      return "Students who signed up";
    case "SIGNED_UP_NO_COURSE":
      return "Signed up, no course chosen";
    case "ELECTIVE":
      return "Students on an elective course";
    case "NOT_SIGNED_UP":
      return "Waiting list (not signed up)";
    case "COURSE":
      return courseNames.length ? `Course: ${courseNames.join(", ")}` : "Selected courses";
    case "PATHWAY":
      return rules.pathway ? `Pathway: ${rules.pathway.replaceAll("_", " ")}` : "Pathway";
    default:
      return "All students";
  }
}

/**
 * How many recipients are claimed from the queue per round, and how many are
 * sent in parallel. Claims are deliberately kept small: a row is marked
 * SENDING before its send and never retried, so a hard kill can skip at most
 * one chunk.
 */
const CLAIM_CHUNK = 25;
const CONCURRENCY = 8;

/**
 * Provider ceiling: SendByte allows 120 requests per 60s per API key, counted
 * across every caller. We aim below it to leave room for the other mail paths
 * (scripts, transactional mail) that share the same key.
 */
const RATE_LIMIT_PER_MIN = 100;
const RATE_WINDOW_MS = 60_000;

/**
 * How long a sender may hold the single-flight lease before it is reclaimed.
 *
 * This MUST exceed the longest budget a single run may take. A round that
 * outlives its own lease gets its lease stolen by the next cron tick, which then
 * sends alongside it — the exact overlap the lease exists to prevent. A 240s
 * round under a 70s lease did that on 2026-09-30 and left 25 rows claimed with
 * no outcome.
 */
const LEASE_TTL_MS = 330_000;

/**
 * Hard ceiling for one invocation, whatever budget the caller asks for.
 *
 * The cron endpoint sets maxDuration 60s and an admin click wants a quick reply,
 * so nothing should run longer than that. A caller passing a longer budget would
 * otherwise outlive the lease above.
 */
const MAX_RUN_BUDGET_MS = 55_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Renew the lease so a long run keeps it.
 *
 * The holder check matters: after a steal the holder is someone else, and
 * renewing unconditionally would take the lease back from a live sender.
 */
async function renewLease(holder: string): Promise<void> {
  await db.$executeRaw`
    UPDATE "CampaignRunLease"
    SET "acquiredAt" = NOW()
    WHERE "id" = 'campaign-sender' AND "holder" = ${holder}
  `;
}

/**
 * Reserve `n` sends against the shared provider window, waiting if the window is
 * full.
 *
 * The counter lives in the database rather than in memory because the ceiling is
 * per API key, not per process: the pg_cron worker and an admin "Drain" can run
 * at the same time, and two in-process limiters would each stay under 120/min
 * while together blowing through it.
 *
 * The increment is a single atomic upsert, so concurrent callers serialise on
 * the row and cannot both read the same count.
 */
async function reserveSendSlots(n: number): Promise<void> {
  for (;;) {
    const rows = await db.$queryRaw<{ count: number; windowStart: Date }[]>`
      INSERT INTO "CampaignRateWindow" ("id", "windowStart", "count")
      VALUES ('global', NOW(), ${n})
      ON CONFLICT ("id") DO UPDATE SET
        "count" = CASE
          WHEN "CampaignRateWindow"."windowStart" < NOW() - ${`${RATE_WINDOW_MS} milliseconds`}::interval
            THEN ${n}
          ELSE "CampaignRateWindow"."count" + ${n}
        END,
        "windowStart" = CASE
          WHEN "CampaignRateWindow"."windowStart" < NOW() - ${`${RATE_WINDOW_MS} milliseconds`}::interval
            THEN NOW()
          ELSE "CampaignRateWindow"."windowStart"
        END
      RETURNING "count", "windowStart"
    `;
    const row = rows[0];
    if (row.count <= RATE_LIMIT_PER_MIN) return;

    // Window is full. Undo the reservation and wait for it to roll over.
    await db.$executeRaw`
      UPDATE "CampaignRateWindow" SET "count" = "count" - ${n} WHERE "id" = 'global'
    `;
    const elapsed = Date.now() - new Date(row.windowStart).getTime();
    const wait = Math.max(250, RATE_WINDOW_MS - elapsed + 100);
    console.log(`[campaign] rate window full, waiting ${Math.round(wait / 1000)}s`);
    await sleep(Math.min(wait, RATE_WINDOW_MS));
  }
}

/**
 * Take the single-flight lease, or report that another sender holds it.
 *
 * Acquire and steal are both conditional UPDATEs, so two callers racing cannot
 * both win. A stale lease (crashed worker) is reclaimed after LEASE_TTL_MS.
 */
async function acquireLease(): Promise<string | null> {
  const holder = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const acquired = await db.$executeRaw`
    UPDATE "CampaignRunLease"
    SET "holder" = ${holder}, "acquiredAt" = NOW()
    WHERE "id" = 'campaign-sender'
      AND "acquiredAt" < NOW() - ${`${LEASE_TTL_MS} milliseconds`}::interval
  `;
  if (acquired > 0) return holder;

  // No row yet — create it. A racing insert loses on the primary key and simply
  // reports the lease as taken.
  const created = await db.$executeRaw`
    INSERT INTO "CampaignRunLease" ("id", "holder", "acquiredAt")
    VALUES ('campaign-sender', ${holder}, NOW())
    ON CONFLICT ("id") DO NOTHING
  `;
  return created > 0 ? holder : null;
}

async function releaseLease(holder: string): Promise<void> {
  // Expire it rather than delete, so the row always exists for the next claim.
  // Scoped to our own holder: if the lease was stolen, expiring it here would
  // release a lease another sender is actively using.
  await db.$executeRaw`
    UPDATE "CampaignRunLease"
    SET "acquiredAt" = NOW() - ${`${LEASE_TTL_MS + 1000} milliseconds`}::interval
    WHERE "id" = 'campaign-sender' AND "holder" = ${holder}
  `;
}

/**
 * Wall-clock budget for one invocation. Vercel Hobby caps functions at 60s, so
 * this leaves headroom to record outcomes before the platform kills the run.
 * Campaigns that don't finish are resumed by the next run.
 */
export const TIME_BUDGET_MS = 45_000;

/**
 * Shorter budget for a send kicked off from the admin UI, so the "Send now"
 * click returns quickly instead of holding the browser for the full window.
 * Whatever is left drains on the next worker run.
 */
export const INTERACTIVE_BUDGET_MS = 20_000;

function apiKey() {
  const key = process.env.SENDBYTE_API_KEY;
  if (!key) throw new Error("SENDBYTE_API_KEY is not set");
  return key;
}

function fromAddress() {
  return process.env.EMAIL_FROM ?? "Unify Creator Academy <uca@launchverse.site>";
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://intranet.launchverse.site").replace(/\/$/, "");
}

/** Signed, stateless unsubscribe link — no per-recipient token table needed. */
export async function unsubscribeUrlFor(email: string) {
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET ?? "insecure-dev-secret");
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(secret);
  return `${appUrl()}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export async function verifyUnsubscribeToken(token: string): Promise<string | null> {
  try {
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET ?? "insecure-dev-secret");
    const { payload } = await jwtVerify(token, secret);
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

/**
 * Send one email through SendByte. Throws on failure so the caller can record
 * the error against the recipient row.
 *
 * A 429 is retried rather than treated as a dead recipient: the provider says
 * exactly when to come back (the Retry-After header, or its `x-ratelimit-reset`
 * equivalent), and the mail is still perfectly deliverable. Marking these FAILED
 * is what stranded 888 recipients.
 */
export async function sendCampaignEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const MAX_ATTEMPTS = 4;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch("https://api.sendbyte.africa/v1/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAddress(),
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });

    if (res.ok) return;

    const body = await res.text();
    const retriable = res.status === 429 || res.status >= 500;
    if (!retriable || attempt >= MAX_ATTEMPTS) {
      throw new Error(`${res.status} ${body.slice(0, 200)}`);
    }

    // Honour the provider's own timing; fall back to exponential backoff.
    const header = res.headers.get("retry-after") ?? res.headers.get("x-ratelimit-reset");
    const parsed = header ? Number(header) : NaN;
    const waitMs = Number.isFinite(parsed) && parsed > 0
      ? Math.min(parsed * 1000, RATE_WINDOW_MS)
      : Math.min(2 ** attempt * 1000, 30_000);
    console.log(`[campaign] ${res.status} for ${input.to}, retry ${attempt}/${MAX_ATTEMPTS - 1} in ${Math.round(waitMs / 1000)}s`);
    await sleep(waitMs);
  }
}

/** Create recipient rows for a campaign, skipping anyone already present. */
export async function materialiseRecipients(campaignId: string) {
  const campaign = await db.emailCampaign.findUnique({
    where: { id: campaignId },
    select: { audience: true },
  });
  if (!campaign) throw new Error("Campaign not found");

  const recipients = await resolveAudience(parseAudience(campaign.audience));
  await db.emailCampaignRecipient.createMany({
    data: recipients.map((r) => ({ campaignId, userId: r.id, email: r.email })),
    skipDuplicates: true,
  });
  await db.emailCampaign.update({
    where: { id: campaignId },
    data: { audienceSize: recipients.length },
  });
  return recipients.length;
}

type ClaimedRecipient = { id: string; email: string };

/**
 * Claim a chunk of pending recipients. `FOR UPDATE SKIP LOCKED` keeps two
 * overlapping worker runs from claiming the same row.
 */
async function claimRecipients(campaignId: string, limit: number): Promise<ClaimedRecipient[]> {
  return db.$queryRaw<ClaimedRecipient[]>`
    UPDATE "EmailCampaignRecipient" SET status = 'SENDING'
    WHERE id IN (
      SELECT id FROM "EmailCampaignRecipient"
      WHERE "campaignId" = ${campaignId} AND status = 'PENDING'
      ORDER BY "createdAt"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, email
  `;
}

export type SendProgress = {
  campaignId: string;
  status: string;
  sent: number;
  failed: number;
  remaining: number;
  done: boolean;
};

/**
 * Send a campaign until it finishes or the time budget runs out.
 *
 * Rows are claimed in small chunks and marked SENDING before the provider call,
 * so a hard kill can skip at most one chunk but can never email anyone twice.
 * Outcomes are written back in bulk. A run that stops early leaves PENDING rows
 * behind, and the next run picks them up.
 */
export async function runCampaign(campaignId: string, timeBudgetMs = TIME_BUDGET_MS): Promise<SendProgress> {
  const startedAt = Date.now();
  // Never run longer than the lease can be held.
  const budget = Math.min(timeBudgetMs, MAX_RUN_BUDGET_MS);

  // Single-flight: the pg_cron worker and an admin "Drain" would otherwise send
  // in parallel, and two callers each pacing to 100/min still total 200/min.
  const holder = await acquireLease();
  if (!holder) {
    const [sent, failed, remaining] = await Promise.all([
      db.emailCampaignRecipient.count({ where: { campaignId, status: "SENT" } }),
      db.emailCampaignRecipient.count({
        where: { campaignId, status: { in: ["FAILED", "SENDING"] } },
      }),
      db.emailCampaignRecipient.count({ where: { campaignId, status: "PENDING" } }),
    ]);
    const current = await db.emailCampaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    });
    return {
      campaignId,
      status: current?.status ?? "SENDING",
      sent,
      failed,
      remaining,
      done: remaining === 0,
    };
  }

  // Keep the lease fresh for as long as this run is alive. Without this, a run
  // longer than LEASE_TTL_MS gets its lease stolen mid-flight.
  const heartbeat = setInterval(() => {
    renewLease(holder).catch(() => {});
  }, 20_000);

  try {
    return await runCampaignLocked(campaignId, startedAt, budget);
  } finally {
    clearInterval(heartbeat);
    await releaseLease(holder);
  }
}

async function runCampaignLocked(
  campaignId: string,
  startedAt: number,
  timeBudgetMs: number
): Promise<SendProgress> {
  const campaign = await db.emailCampaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      subject: true,
      eyebrow: true,
      heading: true,
      body: true,
      ctaLabel: true,
      ctaUrl: true,
      note: true,
      signoff: true,
      imageIds: true,
      style: true,
      status: true,
    },
  });
  if (!campaign) throw new Error("Campaign not found");

  if (campaign.status === "DRAFT" || campaign.status === "SCHEDULED") {
    const pending = await db.emailCampaignRecipient.count({ where: { campaignId } });
    if (pending === 0) await materialiseRecipients(campaignId);
    await db.emailCampaign.update({
      where: { id: campaignId },
      data: { status: "SENDING", startedAt: new Date() },
    });
  }

  const { campaignHtml, campaignPlainText, UNSUBSCRIBE_TOKEN } = await import("./campaign-content");
  const baseHtml = await campaignHtml(campaign);
  const baseText = campaignPlainText(campaign);

  while (Date.now() - startedAt < timeBudgetMs) {
    const claimed = await claimRecipients(campaignId, CLAIM_CHUNK);
    if (claimed.length === 0) break;

    const sentIds: { id: string; at: Date }[] = [];
    const failures: { id: string; error: string }[] = [];

    // Send in bounded slices, and reserve each slice against the shared provider
    // window first so parallel runs cannot together exceed the rate limit.
    for (let i = 0; i < claimed.length; i += CONCURRENCY) {
      const slice = claimed.slice(i, i + CONCURRENCY);
      await reserveSendSlots(slice.length);
      const outcomes = await Promise.all(
        slice.map(async (recipient) => {
          try {
            // One render, many recipients: only the unsubscribe link differs.
            const unsubscribe = await unsubscribeUrlFor(recipient.email);
            await sendCampaignEmail({
              to: recipient.email,
              subject: campaign.subject,
              html: baseHtml.replaceAll(UNSUBSCRIBE_TOKEN, unsubscribe),
              text: `${baseText}\n\nUnsubscribe: ${unsubscribe}`,
            });
            // Stamp when the provider accepted this send, not when the chunk was
            // flushed. A shared flush timestamp made rate audits unreliable: a
            // 25-row bulk write can land inside one wall-clock minute and look
            // like 25 sends in the same second, hiding the real pacing.
            return { id: recipient.id, ok: true as const, at: new Date() };
          } catch (err) {
            return {
              id: recipient.id,
              ok: false as const,
              error: err instanceof Error ? err.message.slice(0, 300) : String(err),
            };
          }
        })
      );
      for (const o of outcomes) {
        if (o.ok) sentIds.push({ id: o.id, at: o.at });
        else failures.push({ id: o.id, error: o.error });
      }
    }

    // Write outcomes. Each successful send carries its own timestamp so the
    // record reflects when the provider accepted it, not when this flush ran.
    // Chunked to keep the statement small on large claims.
    for (let i = 0; i < sentIds.length; i += 100) {
      const chunk = sentIds.slice(i, i + 100);
      await db.$transaction(
        chunk.map((s) =>
          db.emailCampaignRecipient.updateMany({
            where: { id: s.id },
            data: { status: "SENT", sentAt: s.at },
          })
        )
      );
    }
    for (const f of failures) {
      await db.emailCampaignRecipient.update({
        where: { id: f.id },
        data: { status: "FAILED", error: f.error },
      });
    }
  }

  const [sent, failed, remaining] = await Promise.all([
    db.emailCampaignRecipient.count({ where: { campaignId, status: "SENT" } }),
    // A row still marked SENDING means the process died after claiming it but
    // before recording an outcome. It is never retried — consistent with the
    // repo's bulk-mail rule that a crash may skip someone but must never email
    // anyone twice — so it is reported as failed rather than left outstanding.
    db.emailCampaignRecipient.count({
      where: { campaignId, status: { in: ["FAILED", "SENDING"] } },
    }),
    db.emailCampaignRecipient.count({ where: { campaignId, status: "PENDING" } }),
  ]);

  const done = remaining === 0;
  // Only call a campaign SENT when it truly finished. A run that stopped with
  // recipients still PENDING (budget exhausted) stays SENDING and resumes; one
  // that finished the queue but left FAILED rows is reported as FAILED so the
  // failures are visible instead of hiding behind a SENT badge.
  if (done) {
    const failedCount = await db.emailCampaignRecipient.count({
      where: { campaignId, status: { in: ["FAILED", "SENDING"] } },
    });
    await db.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: failedCount > 0 ? "FAILED" : "SENT",
        completedAt: new Date(),
      },
    });
  }

  const fresh = await db.emailCampaign.findUnique({ where: { id: campaignId }, select: { status: true } });
  return { campaignId, status: fresh?.status ?? "SENDING", sent, failed, remaining, done };
}

/**
 * Advance every campaign that is due: scheduled ones whose time has passed,
 * plus any left mid-send. Called by the cron endpoint.
 *
 * The time budget is shared across campaigns so one large send cannot starve
 * the others and push the invocation past the platform limit. Anything not
 * finished simply stays SENDING and is picked up by the next run.
 */
export async function runDueCampaigns(limit = 3): Promise<SendProgress[]> {
  const startedAt = Date.now();
  const due = await db.emailCampaign.findMany({
    where: {
      OR: [
        { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
        { status: "SENDING" },
      ],
    },
    select: { id: true },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });

  const results: SendProgress[] = [];
  for (const { id } of due) {
    const remaining = TIME_BUDGET_MS - (Date.now() - startedAt);
    if (remaining < 5_000) break;
    try {
      results.push(await runCampaign(id, remaining));
    } catch (err) {
      // Leave it resumable rather than permanently FAILED — with a daily cron a
      // transient error must not strand the remaining recipients.
      await db.emailCampaign.update({ where: { id }, data: { status: "SENDING" } });
      console.error("[campaign] run failed, will retry", id, err);
    }
  }
  return results;
}