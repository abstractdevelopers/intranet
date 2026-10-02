/**
 * Draft the two weekend campaigns (not-signed-up reclaim, signed-up setup).
 *
 * Read-only against real data: it renders the campaign HTML through the real
 * renderer, writes preview files, and (with --write) creates DRAFT rows in
 * /admin/campaigns. It materialises no recipients, so a draft cannot send.
 *
 *   npx tsx scripts/draft-weekend-campaigns.ts
 *   npx tsx scripts/draft-weekend-campaigns.ts --write
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import { renderCampaign, campaignText } from "../src/lib/email-campaigns";
import {
  WEEKEND_CAMPAIGNS,
  NOT_SIGNED_UP_WHERE,
  SIGNED_UP_WHERE,
  loadSuppressedEmails,
} from "../src/lib/weekend-campaign";

const db = new PrismaClient();
const WRITE = process.argv.slice(2).includes("--write");

async function main() {
  const suppressed = loadSuppressedEmails();

  const notSigned = (await db.user.findMany({
    where: NOT_SIGNED_UP_WHERE,
    select: { email: true },
  })).filter((u) => !suppressed.has(u.email.toLowerCase()));

  const signedUp = (await db.user.findMany({
    where: SIGNED_UP_WHERE,
    select: { email: true },
  })).filter((u) => !suppressed.has(u.email.toLowerCase()));

  const counts: Record<string, number> = {
    NOT_SIGNED_UP: notSigned.length,
    SIGNED_UP: signedUp.length,
  };

  for (const d of WEEKEND_CAMPAIGNS) {
    const html = renderCampaign(
      {
        eyebrow: d.eyebrow,
        heading: d.heading,
        body: d.body,
        ctaLabel: d.ctaLabel,
        ctaUrl: d.ctaUrl,
        note: d.note,
        signoff: d.signoff,
        preheader: d.preheader,
        unsubscribeUrl: `${d.ctaUrl.split("/").slice(0, 3).join("/")}/unsubscribe?token=SAMPLE`,
      },
      d.style
    );
    const text = campaignText(d);

    console.log("=".repeat(74));
    console.log(`AUDIENCE : ${d.audience} — ${counts[d.audience]} recipients (bounces excluded)`);
    console.log(`STYLE    : ${d.style}`);
    console.log(`SUBJECT  : ${d.subject}`);
    console.log("=".repeat(74));
    console.log();
    console.log(d.eyebrow.toUpperCase());
    console.log();
    console.log(d.heading);
    console.log();
    console.log(text.split("\n\n").slice(1, -3).join("\n\n"));
    console.log();
    console.log(`[ ${d.ctaLabel} ] -> ${d.ctaUrl}`);
    console.log();
    console.log("Note:", d.note);
    console.log(d.signoff);
    console.log();
    console.log("placeholder text present:", html.includes("Add an image to this campaign") ? "YES (would ship!)" : "no");
    console.log();

    const file = `/tmp/${d.audience.toLowerCase()}-weekend.html`;
    writeFileSync(file, html);
    console.log(`HTML preview -> ${file}`);

    if (WRITE) {
      const admin = await db.user.findFirst({ where: { role: "FOUNDER" }, select: { id: true } });
      if (!admin) throw new Error("No FOUNDER to attribute the draft to");
      const existing = await db.emailCampaign.findFirst({ where: { title: d.title } });
      if (existing) {
        await db.emailCampaign.update({
          where: { id: existing.id },
          data: {
            subject: d.subject, eyebrow: d.eyebrow, heading: d.heading, body: d.body,
            ctaLabel: d.ctaLabel, ctaUrl: d.ctaUrl, note: d.note, signoff: d.signoff, style: d.style,
          },
        });
        console.log(`Updated DRAFT ${existing.id}`);
      } else {
        const created = await db.emailCampaign.create({
          data: {
            title: d.title, subject: d.subject, eyebrow: d.eyebrow, heading: d.heading, body: d.body,
            ctaLabel: d.ctaLabel, ctaUrl: d.ctaUrl, note: d.note, signoff: d.signoff, style: d.style,
            audience: JSON.stringify({ audience: d.audience, courseIds: [], pathway: null }),
            status: "DRAFT", createdById: admin.id,
          },
        });
        console.log(`Created DRAFT ${created.id}`);
      }
    }
  }

  if (!WRITE) console.log("\nDraft only — nothing written. Use --write to create the DRAFT rows.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
