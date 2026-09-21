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

/** How many recipients the public app URL should be advertised as. */
export const BATCH_SIZE = 40;

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
 * Send up to `maxBatches` chunks of a campaign. Returns after the batch limit
 * so a serverless invocation stays short; the cron job calls again until the
 * campaign reports `done`.
 */
export async function runCampaign(campaignId: string, maxBatches = 5): Promise<SendProgress> {
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

  for (let batch = 0; batch < maxBatches; batch++) {
    const claimed = await claimRecipients(campaignId, BATCH_SIZE);
    if (claimed.length === 0) break;

    await Promise.all(
      claimed.map(async (recipient) => {
        try {
          // One render, many recipients: only the unsubscribe link differs.
          const unsubscribe = await unsubscribeUrlFor(recipient.email);
          const html = baseHtml.replaceAll(UNSUBSCRIBE_TOKEN, unsubscribe);
          const text = `${baseText}\n\nUnsubscribe: ${unsubscribe}`;
          await sendCampaignEmail({
            to: recipient.email,
            subject: campaign.subject,
            html,
            text,
          });
          await db.emailCampaignRecipient.update({
            where: { id: recipient.id },
            data: { status: "SENT", sentAt: new Date() },
          });
        } catch (err) {
          await db.emailCampaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: "FAILED",
              error: err instanceof Error ? err.message.slice(0, 300) : String(err),
            },
          });
        }
      })
    );
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
 * Advance any campaign that is due: scheduled ones whose time has passed, plus
 * any still sending. Called by the cron endpoint.
 */
export async function runDueCampaigns(limit = 3): Promise<SendProgress[]> {
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
    try {
      results.push(await runCampaign(id, 5));
    } catch (err) {
      await db.emailCampaign.update({
        where: { id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
        },
      });
      console.error("[campaign] failed", id, err);
    }
  }
  return results;
}