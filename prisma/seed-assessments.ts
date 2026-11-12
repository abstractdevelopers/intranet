/**
 * Seed the end-of-term assessments.
 *
 * Creates one theory and one practical paper per pathway, each with the shared
 * window (opens Thursday 12 November 10:00 WAT, closes Saturday 14 November
 * 14:00 WAT) and no questions yet — the questions are supplied later.
 *
 * Question content is read from JSON files in `content/assessments/` when they
 * exist, so the papers can be filled in without editing this script:
 *
 *   content/assessments/<pathway-slug>-theory.json
 *   content/assessments/<pathway-slug>-practical.json
 *
 * Theory file shape:
 *   {
 *     "title": "…", "description": "…", "instructions": "…",
 *     "questions": [
 *       { "kind": "MCQ", "prompt": "…", "points": 2,
 *         "options": ["A", "B", "C", "D"], "correct": 1, "explanation": "…" },
 *       { "kind": "TEXT", "prompt": "…", "points": 10, "explanation": "…" }
 *     ]
 *   }
 *
 * Practical file shape:
 *   { "title": "…", "description": "…", "instructions": "…", "maxScore": 100 }
 *
 * Idempotent: re-running updates the paper settings and replaces its questions.
 * Existing submissions are never touched.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { PATHWAYS, PATHWAY_LABELS, type Pathway } from "../src/lib/constants";

const db = new PrismaClient();

const CONTENT_DIR = path.join(process.cwd(), "content", "assessments");

/** The shared window, matching the academy-wide dates in constants.ts. */
const OPENS_AT = new Date("2026-11-12T09:00:00.000Z"); // 10:00 WAT Thu
const CLOSES_AT = new Date("2026-11-14T13:00:00.000Z"); // 14:00 WAT Sat

type TheoryQuestion = {
  kind: "MCQ" | "TEXT";
  prompt: string;
  points: number;
  explanation?: string;
  options?: string[];
  correct?: number;
};

type TheoryContent = {
  title?: string;
  description?: string;
  instructions?: string;
  passMark?: number;
  questions?: TheoryQuestion[];
};

type PracticalContent = {
  title?: string;
  description?: string;
  instructions?: string;
  maxScore?: number;
  passMark?: number;
};

function slugForPathway(pathway: Pathway) {
  return pathway.toLowerCase().replace(/_/g, "-");
}

function readContent<T>(file: string): T | null {
  const full = path.join(CONTENT_DIR, file);
  if (!existsSync(full)) return null;
  try {
    return JSON.parse(readFileSync(full, "utf8")) as T;
  } catch (err) {
    console.error(`Could not parse ${full}:`, err);
    return null;
  }
}

async function upsertTheory(pathway: Pathway, content: TheoryContent | null) {
  const slug = `${slugForPathway(pathway)}-theory`;
  const label = PATHWAY_LABELS[pathway];

  const assessment = await db.assessment.upsert({
    where: { slug },
    create: {
      slug,
      title: content?.title ?? `${label} — Theory Assessment`,
      description: content?.description ?? `Theory paper for the ${label} pathway.`,
      kind: "THEORY",
      pathway,
      instructions: content?.instructions ?? null,
      openAt: OPENS_AT,
      closeAt: CLOSES_AT,
      passMark: content?.passMark ?? 50,
      status: "PUBLISHED",
    },
    update: {
      title: content?.title ?? `${label} — Theory Assessment`,
      description: content?.description ?? `Theory paper for the ${label} pathway.`,
      pathway,
      instructions: content?.instructions ?? null,
      openAt: OPENS_AT,
      closeAt: CLOSES_AT,
      passMark: content?.passMark ?? 50,
      status: "PUBLISHED",
    },
  });

  const questions = content?.questions ?? [];
  if (questions.length > 0) {
    await db.assessmentQuestion.deleteMany({ where: { assessmentId: assessment.id } });
    for (const [index, q] of questions.entries()) {
      const kind = q.kind === "TEXT" ? "TEXT" : "MCQ";
      await db.assessmentQuestion.create({
        data: {
          assessmentId: assessment.id,
          kind,
          prompt: q.prompt,
          explanation: q.explanation ?? null,
          points: q.points ?? 1,
          order: index,
          options:
            kind === "MCQ"
              ? {
                  create: (q.options ?? []).map((label, i) => ({
                    label,
                    isCorrect: i === q.correct,
                    order: i,
                  })),
                }
              : undefined,
        },
      });
    }
  }

  return { slug, questions: questions.length };
}

async function upsertPractical(pathway: Pathway, content: PracticalContent | null) {
  const slug = `${slugForPathway(pathway)}-practical`;
  const label = PATHWAY_LABELS[pathway];

  const data = {
    title: content?.title ?? `${label} — Practical Assessment`,
    description: content?.description ?? `Practical paper for the ${label} pathway.`,
    instructions: content?.instructions ?? null,
    maxScore: content?.maxScore ?? 100,
    passMark: content?.passMark ?? 50,
    openAt: OPENS_AT,
    closeAt: CLOSES_AT,
    status: "PUBLISHED",
  };

  await db.assessment.upsert({
    where: { slug },
    create: { slug, kind: "PRACTICAL", pathway, ...data },
    update: { pathway, ...data },
  });

  return { slug };
}

async function main() {
  // Ensure the shared weights row exists so the admin dashboard has something
  // to edit from the first visit.
  await db.assessmentConfig.upsert({
    where: { id: "global" },
    create: { id: "global", assignmentWeight: 50, theoryWeight: 30, practicalWeight: 20 },
    update: {},
  });

  const summary: string[] = [];
  for (const pathway of Object.keys(PATHWAYS) as Pathway[]) {
    const slug = slugForPathway(pathway);
    const theory = readContent<TheoryContent>(`${slug}-theory.json`);
    const practical = readContent<PracticalContent>(`${slug}-practical.json`);

    const t = await upsertTheory(pathway, theory);
    const p = await upsertPractical(pathway, practical);
    summary.push(`${PATHWAY_LABELS[pathway]}: ${t.slug} (${t.questions} questions), ${p.slug}`);
  }

  console.log("Seeded assessments:");
  for (const line of summary) console.log(`  ${line}`);
  console.log(`\nWindow: ${OPENS_AT.toISOString()} → ${CLOSES_AT.toISOString()}`);
  console.log(
    "Add questions by creating content/assessments/<pathway>-theory.json and re-running.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
