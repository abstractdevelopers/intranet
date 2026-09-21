/**
 * Render the onboarding-week emails to .preview/ so the exact copy can be
 * reviewed before any bulk send. Nothing is sent and no database row changes.
 *
 *   npx tsx scripts/preview-onboarding-week.ts
 */
import { writeFile, mkdir } from "fs/promises";
import {
  onboardingWeekEmail,
  onboardingWeekSignedUpEmail,
} from "../src/lib/email-templates";

const APP_URL = "https://intranet.launchverse.site";
const SAMPLE = "sample.creator@example.com";

async function main() {
  await mkdir(".preview", { recursive: true });
  const sets = [
    { name: "not-signed-up", mail: onboardingWeekEmail({ email: SAMPLE, loginUrl: `${APP_URL}/login`, forgotUrl: `${APP_URL}/forgot-password` }) },
    { name: "signed-up", mail: onboardingWeekSignedUpEmail({ email: SAMPLE, loginUrl: `${APP_URL}/login`, forgotUrl: `${APP_URL}/forgot-password` }) },
  ];
  for (const { name, mail } of sets) {
    await writeFile(`.preview/${name}.html`, mail.html);
    console.log("=".repeat(72));
    console.log(`VARIANT : ${name}`);
    console.log(`SUBJECT : ${mail.subject}`);
    console.log("-".repeat(72));
    console.log(mail.text);
    console.log("");
  }
  console.log("HTML written to .preview/not-signed-up.html and .preview/signed-up.html");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
