import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/rbac";
import { renderCampaign } from "@/lib/email-campaigns";
import { publicImageUrls, UNSUBSCRIBE_TOKEN } from "@/lib/campaign-content";
import { resolveAudience, describeAudience, type AudienceRules } from "@/lib/campaign-sender";

/**
 * Two composer helpers used by the admin UI:
 *   POST { mode: "PREVIEW" }  → branded HTML for unsaved content
 *   POST { mode: "AUDIENCE" } → how many people the current rules would reach
 *
 * Both accept unsaved input so the admin sees real results before saving.
 */
export async function POST(request: Request) {
  await requireStaff();
  const payload = (await request.json().catch(() => null)) as {
    mode?: "PREVIEW" | "AUDIENCE";
    eyebrow?: string;
    heading?: string;
    body?: string;
    ctaLabel?: string;
    ctaUrl?: string;
    note?: string;
    signoff?: string;
    imageIds?: string[];
    style?: string;
    audience?: AudienceRules["audience"];
    courseIds?: string[];
    pathway?: string | null;
  } | null;

  if (!payload) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  if (payload.mode === "AUDIENCE") {
    const rules: AudienceRules = {
      audience: payload.audience ?? "ALL_STUDENTS",
      courseIds: payload.courseIds ?? [],
      pathway: payload.pathway ?? null,
    };
    const recipients = await resolveAudience(rules);
    return NextResponse.json({ count: recipients.length, label: describeAudience(rules) });
  }

  if (!payload.heading || !payload.body) {
    return NextResponse.json({ error: "A heading and body are required." }, { status: 400 });
  }

  const html = renderCampaign(
    {
      eyebrow: payload.eyebrow || "UCA Sandbox",
      heading: payload.heading,
      body: payload.body,
      ctaLabel: payload.ctaLabel || null,
      ctaUrl: payload.ctaUrl || null,
      note: payload.note || null,
      signoff: payload.signoff || null,
      images: publicImageUrls(JSON.stringify(payload.imageIds ?? [])),
      unsubscribeUrl: UNSUBSCRIBE_TOKEN,
    },
    payload.style ?? "BANNER"
  );

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}