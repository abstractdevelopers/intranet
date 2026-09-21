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

export type AudienceKind = "ALL_STUDENTS" | "SIGNED_UP" | "NOT_SIGNED_UP" | "COURSE" | "PATHWAY";

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

/** Reasonable upper bound so a stray rule can't target the wrong population. */
export function parseAudience(raw: string): AudienceRules {
  try {
    const parsed = JSON.parse(raw) as AudienceRules;
    if (
      parsed &&
      ["ALL_STUDENTS", "SIGNED_UP", "NOT_SIGNED_UP", "COURSE", "PATHWAY"].includes(parsed.audience)
    ) {
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
  const base: Prisma.UserWhereInput = {
    role: "STUDENT",
    status: "ACTIVE",
    emailOptOutAt: null,
  };

  let audienceFilter: Prisma.UserWhereInput = {};
  if (rules.audience === "SIGNED_UP") audienceFilter = SIGNED_UP;
  else if (rules.audience === "NOT_SIGNED_UP") audienceFilter = NOT_SIGNED_UP;
  else if (rules.audience === "COURSE") {
    audienceFilter = { enrollments: { some: { courseId: { in: rules.courseIds ?? [] } } } };
  } else if (rules.audience === "PATHWAY") {
    // Applications record the chosen elective as a course, so the pathway is
    // read through that relation rather than stored on the application itself.
    audienceFilter = {
      OR: [
        { enrollments: { some: { pathway: rules.pathway ?? undefined } } },
        { applications: { some: { selectedElective: { pathway: rules.pathway ?? undefined } } } },
      ],
    };
  }

  return db.user.findMany({
    where: { AND: [base, audienceFilter] },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });
}

export function describeAudience(rules: AudienceRules, courseNames: string[] = []): string {
  switch (rules.audience) {
    case "SIGNED_UP":
      return "Students who signed up";
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
const CONCURRENCY = 15;

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
 */
export async function sendCampaignEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
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
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${body.slice(0, 200)}`);
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

    const sentIds: string[] = [];
    const failures: { id: string; error: string }[] = [];

    // Send in parallel but in bounded slices, so a chunk never opens more
    // sockets than the provider will tolerate.
    for (let i = 0; i < claimed.length; i += CONCURRENCY) {
      const slice = claimed.slice(i, i + CONCURRENCY);
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
            return { id: recipient.id, ok: true as const };
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
        if (o.ok) sentIds.push(o.id);
        else failures.push({ id: o.id, error: o.error });
      }
    }

    // Bulk success write; failures carry a per-row message so they stay visible.
    if (sentIds.length > 0) {
      await db.emailCampaignRecipient.updateMany({
        where: { id: { in: sentIds } },
        data: { status: "SENT", sentAt: new Date() },
      });
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
  if (done) {
    await db.emailCampaign.update({
      where: { id: campaignId },
      data: { status: "SENT", completedAt: new Date() },
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