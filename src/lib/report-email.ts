import { layout } from "./email-templates";
import { type ResultBand } from "./constants";

/**
 * End-of-term report emails.
 *
 * One report per student, sent when staff release results. The message is
 * chosen by the student's overall band — below 50%, 50-69%, or 70-100% — and
 * the same score table is inserted into all three, so the student always sees
 * the exact breakdown that produced their figure.
 *
 * `layout` is reused from the transactional templates so the report carries the
 * same branded shell (purple hero, white body, quiet footer) as every other
 * academy email.
 */

export type ReportRow = { label: string; value: string };

export type ReportEmailInput = {
  name: string;
  overallPercent: number;
  band: ResultBand;
  rows: ReportRow[];
  /** The student's released result page, if the portal exposes one. */
  resultsUrl?: string;
};

const BAND_COPY: Record<
  ResultBand,
  { eyebrow: string; heading: string; paragraphs: string[]; highlights: string[]; signoff: string }
> = {
  FAIL: {
    eyebrow: "Your term result",
    heading: "Your result is in — and there's a clear path forward",
    paragraphs: [
      "Thank you for the effort you put into this term. Sitting the assessments and submitting your work is not nothing, and it is the foundation everything else is built on.",
      "Your overall score came in below 50%, so there is real ground to make up. The good news is that the gap is knowable: your breakdown below shows exactly where the marks were lost, and each part can be worked on.",
      "We would rather you finish the programme stronger than start it perfectly. Come back to your feedback, rework the pieces that scored lowest, and use your next submission to close the gap.",
    ],
    highlights: [
      "Read the feedback on each component below — it points at what to fix first.",
      "Rebuild your weakest piece and treat it as a fresh attempt.",
      "Reach out to your facilitator if you want a hand identifying the gap.",
    ],
    signoff: "Keep going. We're with you. — The UCA Sandbox team",
  },
  PROGRESS: {
    eyebrow: "Your term result",
    heading: "Your result is in — solid progress",
    paragraphs: [
      "Well done on the work you put in this term. Your overall score landed between 50% and 69%, which means you are building real understanding and the fundamentals are there.",
      "This is a good place to be: the distance between here and the top band is usually a matter of polish and consistency rather than a change of approach. Your breakdown below shows which component has the most room to grow.",
      "Keep the habits that got you here, and put a little extra into your weaker area. That is very often the whole difference.",
    ],
    highlights: [
      "Look at which component scored lowest — that is your highest-leverage fix.",
      "Keep your stronger component strong; don't let it slip while you improve the other.",
      "Ask for feedback on one piece before the next submission.",
    ],
    signoff: "Strong progress. Keep building. — The UCA Sandbox team",
  },
  DISTINCTION: {
    eyebrow: "Your term result",
    heading: "Your result is in — congratulations",
    paragraphs: [
      "Congratulations. Your overall score came in at 70% or above, which places you in the top band for this term. That is a real achievement and it reflects the quality and consistency of your work.",
      "Your breakdown below shows how the result was built — assignment work, theory and practical. Every component pulled its weight.",
      "The task now is to hold this standard. The work you have made is worth keeping, and the discipline that produced it is what will carry you through the rest of the programme.",
    ],
    highlights: [
      "Your work this term is a portfolio piece — keep it polished and published.",
      "Maintain the standard you set here; consistency is the whole game.",
      "Consider helping a coursemate who is finding the material hard.",
    ],
    signoff: "Outstanding work. — The UCA Sandbox team",
  },
};

function textList(items: string[]) {
  return items.map((i) => `  • ${i}`).join("\n");
}

/**
 * Build the report email. The same table is rendered in both the HTML and the
 * plain-text version, and the band selects the message.
 */
export function resultReportEmail(input: ReportEmailInput) {
  const copy = BAND_COPY[input.band];
  const table = [...input.rows, { label: "Overall", value: `${input.overallPercent}%` }];

  const html = layout({
    eyebrow: copy.eyebrow,
    heading: copy.heading,
    paragraphs: [`Dear ${input.name},`, ...copy.paragraphs],
    tableLabel: "Your breakdown",
    table,
    highlightsLabel: "What to do next",
    highlights: copy.highlights,
    cta: input.resultsUrl ? { label: "View your result", url: input.resultsUrl } : undefined,
    signoff: copy.signoff,
    preheader: `Your overall score: ${input.overallPercent}%`,
  });

  const text = [
    copy.heading,
    "",
    `Dear ${input.name},`,
    "",
    ...copy.paragraphs.flatMap((p) => [p, ""]),
    "YOUR BREAKDOWN",
    ...input.rows.map((r) => `  ${r.label}: ${r.value}`),
    `  Overall: ${input.overallPercent}%`,
    "",
    "WHAT TO DO NEXT",
    textList(copy.highlights),
    "",
    ...(input.resultsUrl ? [`View your result: ${input.resultsUrl}`, ""] : []),
    copy.signoff,
  ].join("\n");

  const subject =
    input.band === "DISTINCTION"
      ? `Your UCA Sandbox result: ${input.overallPercent}% — congratulations`
      : input.band === "PROGRESS"
        ? `Your UCA Sandbox result: ${input.overallPercent}% — good progress`
        : `Your UCA Sandbox result: ${input.overallPercent}%`;

  return { subject, html, text };
}
