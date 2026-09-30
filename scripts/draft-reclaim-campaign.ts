/**
 * Draft the "reclaim your account" campaign for students who signed up but never
 * started (the NOT_SIGNED_UP audience: no username, no onboarding, no
 * application).
 *
 * This script only DRAFTS. It renders the real campaign HTML, writes a preview
 * file, and creates a DRAFT row in /admin/campaigns so the copy can be reviewed
 * and edited there. It sends nothing.
 *
 *   npx tsx scripts/draft-reclaim-campaign.ts
 *   npx tsx scripts/draft-reclaim-campaign.ts --write   (also creates the DRAFT row)
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import { renderCampaign, campaignText } from "../src/lib/email-campaigns";

const db = new PrismaClient();
const WRITE = process.argv.slice(2).includes("--write");

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://intranet.launchverse.site").replace(/\/$/, "");

/**
 * The reclaim CTA points at the generic forgot-password page.
 *
 * A campaign renders ONE url for every recipient, so it cannot carry the
 * per-recipient single-use token the original reclaim email minted. The generic
 * page is safe but less direct: the student enters their email and gets a fresh
 * reset link. The alternative is a per-recipient send (like send-reclaim.ts),
 * which is a different mechanism from a campaign.
 */
const CTA_URL = `${APP_URL}/forgot-password`;

const COPY = {
  eyebrow: "Your seat is still here",
  heading: "You picked a lane. We built the whole road.",
  body: [
    "You signed up for UCA Sandbox a while back. Then life did what life does.",
    "Everything is built now — four pathways, real classes, and a studio to put your work in. Your account has been sitting here the whole time, and it is still yours.",
    "Four crafts: Graphics Design, Video Editing, Communication & Influence, Content Writing. Pick one and we will build the rest of your programme around it.",
    "Classes start Monday 5 October. 21 Elite Member spots are still unclaimed. And your free month starts the day you come back — not the day you signed up.",
  ].join("\n\n"),
  ctaLabel: "Take back my account",
  ctaUrl: CTA_URL,
  note: "₦15,000/month per course after your free month. Nothing to pay to get started.",
  signoff: "— The UCA Sandbox team",
};

const TITLE = "Reclaim — you signed up, your seat is still here";
const STYLE = "NOTE";

async function main() {
  const audience = await db.user.count({
    where: {
      role: "STUDENT",
      status: "ACTIVE",
      emailOptOutAt: null,
      username: null,
      onboardingCompletedAt: null,
      applications: { none: {} },
      enrollments: { none: {} },
    },
  });

  const html = renderCampaign(
    {
      ...COPY,
      preheader: "Your UCA Sandbox account is still yours. Come take it back.",
      unsubscribeUrl: `${APP_URL}/unsubscribe?token=SAMPLE`,
    },
    STYLE
  );

  const text = campaignText(COPY);

  console.log("=".repeat(72));
  console.log("SUBJECT:", COPY.heading);
  console.log("STYLE  :", STYLE);
  console.log("AUDIENCE: NOT_SIGNED_UP —", audience, "deliverable recipients");
  console.log("=".repeat(72));
  console.log();
  console.log(COPY.eyebrow.toUpperCase());
  console.log();
  console.log(COPY.heading);
  console.log();
  console.log(text.split("\n\n").slice(1, 5).join("\n\n"));
  console.log();
  console.log("[ " + COPY.ctaLabel + " ] -> " + CTA_URL);
  console.log();
  console.log("Note:", COPY.note);
  console.log(COPY.signoff);
  console.log();
  console.log("=".repeat(72));

  writeFileSync("/tmp/reclaim-draft.html", html);
  console.log("HTML preview written to /tmp/reclaim-draft.html");

  if (!WRITE) {
    console.log("\nDraft only — nothing written to the database. Use --write to create the DRAFT row.");
    return;
  }

  const admin = await db.user.findFirst({
    where: { role: "FOUNDER" },
    select: { id: true },
  });
  if (!admin) throw new Error("No FOUNDER user to attribute the draft to");

  const existing = await db.emailCampaign.findFirst({ where: { title: TITLE } });
  if (existing) {
    await db.emailCampaign.update({
      where: { id: existing.id },
      data: { ...COPY, subject: COPY.heading, style: STYLE },
    });
    console.log("Updated existing DRAFT:", existing.id);
    return;
  }

  const created = await db.emailCampaign.create({
    data: {
      title: TITLE,
      subject: COPY.heading,
      eyebrow: COPY.eyebrow,
      heading: COPY.heading,
      body: COPY.body,
      ctaLabel: COPY.ctaLabel,
      ctaUrl: COPY.ctaUrl,
      note: COPY.note,
      signoff: COPY.signoff,
      style: STYLE,
      audience: JSON.stringify({ audience: "NOT_SIGNED_UP", courseIds: [], pathway: null }),
      status: "DRAFT",
      createdById: admin.id,
    },
  });
  console.log("Created DRAFT campaign:", created.id);
  console.log("Review and send it from /admin/campaigns.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
