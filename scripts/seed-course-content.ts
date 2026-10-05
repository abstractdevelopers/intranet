/**
 * Seed course content from a JSON file, with release scheduling.
 *
 * One Module row per WEEK, because Module.weekNumber and the Captain's Log gate
 * are both per-week (a two-week module is two rows). Content is seeded as
 * PUBLISHED with a future `releaseAt`, which is what "scheduled but not yet
 * visible" means in this app: DRAFT would hide it even after release.
 *
 * All writes are additive upserts keyed on a stable slug/order, so re-running
 * updates rather than duplicating. Nothing is ever deleted.
 *
 * Usage:
 *   npx tsx scripts/seed-course-content.ts content/week-1.json          (dry run)
 *   npx tsx scripts/seed-course-content.ts content/week-1.json --apply
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "fs";
import { atWat, watLabel } from "../src/lib/schedule";

const db = new PrismaClient();
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const FILE = args.find((a) => !a.startsWith("--"));

/**
 * Shape of the seed file. Only `courseSlug` and `weeks` are required; everything
 * else is optional so a minimal file still seeds.
 */
type Seed = {
  courseSlug: string;
  weeks: {
    weekNumber: number;
    moduleNumber?: number;
    title: string;
    overview?: string;
    objectives?: string;
    /** "YYYY-MM-DD" — released at 10:00 WAT on this date. */
    releaseDate: string;
    lessons?: {
      title: string;
      content?: string;
      youtubeVideoId?: string;
      durationMin?: number;
      /** "YYYY-MM-DD" — release this day's lessons at 10:00 WAT. Omit to inherit the week's release. */
      releaseDate?: string;
      /** Attach a PDF to this lesson (embedded via the in-app reader). */
      pdf?: { title: string; documentId?: string; url?: string; localPath?: string };
    }[];
    assignment?: {
      title: string;
      description: string;
      instructions?: string;
      requirements?: string;
      /** "YYYY-MM-DD" — opens at 10:00 WAT on this date. Omit to inherit the week's release. */
      releaseDate?: string;
      /** "YYYY-MM-DD" — due 23:59 WAT on this date. */
      deadlineDate?: string;
      allowedTypes?: string[];
      maxAttempts?: number;
      latePolicy?: string;
      maxFileSizeMb?: number;
    };
    quiz?: SeedQuiz;
    /** Several quizzes on one week — Monday's and Tuesday's share a module. */
    quizzes?: SeedQuiz[];
  }[];
};

type SeedQuiz = {
  /** Stable id for the quiz; re-running updates this row in place. */
  slug: string;
  title: string;
  description?: string;
  passMark?: number;
  maxAttempts?: number;
  /** "YYYY-MM-DD" — opens at 10:00 WAT on this date. Omit to inherit the week's release. */
  releaseDate?: string;
  questions: {
    prompt: string;
    options: string[];
    /** Index into `options` of the correct answer. */
    correct: number;
    explanation?: string;
  }[];
};

/**
 * Both quiz spellings, so a single `quiz` (the common case) and a `quizzes`
 * list (a week whose days each have their own quiz) work from one code path.
 */
function weekQuizzes(w: Seed["weeks"][number]): SeedQuiz[] {
  return [...(w.quiz ? [w.quiz] : []), ...(w.quizzes ?? [])];
}

async function main() {
  if (!FILE) throw new Error("Pass a seed file, e.g. content/week-1.json");
  if (!existsSync(FILE)) throw new Error(`No such file: ${FILE}`);

  const seed = JSON.parse(readFileSync(FILE, "utf8")) as Seed;
  const course = await db.course.findUnique({ where: { slug: seed.courseSlug } });
  if (!course) throw new Error(`No course with slug "${seed.courseSlug}"`);

  console.log(`Course : ${course.name} (${course.slug})`);
  console.log(`Weeks  : ${seed.weeks.length}`);
  console.log();

  for (const w of seed.weeks) {
    const releaseAt = atWat(w.releaseDate);
    console.log(`  Week ${w.weekNumber} — ${w.title}`);
    console.log(`    releases   : ${watLabel(releaseAt)}  (${releaseAt.toISOString()})`);
    console.log(`    lessons    : ${w.lessons?.length ?? 0}`);
    for (const l of w.lessons ?? []) {
      if (l.releaseDate) console.log(`      · ${l.title} -> ${watLabel(atWat(l.releaseDate))}`);
    }
    if (w.assignment) {
      const opens = w.assignment.releaseDate ? watLabel(atWat(w.assignment.releaseDate)) : "inherits the week";
      const due = w.assignment.deadlineDate ? watLabel(atWat(w.assignment.deadlineDate, 23, 59)) : "(no deadline)";
      console.log(`    assignment : ${w.assignment.title}`);
      console.log(`      opens    : ${opens}`);
      console.log(`      due      : ${due}`);
      console.log(`      accepts  : ${(w.assignment.allowedTypes ?? []).join(", ")}`);
      console.log(`      late     : ${w.assignment.latePolicy ?? "ALLOW"}`);
    }
    for (const qz of weekQuizzes(w)) {
      const opens = qz.releaseDate ? watLabel(atWat(qz.releaseDate)) : "inherits the week";
      console.log(`    quiz       : ${qz.title}  (${qz.slug})`);
      console.log(`      opens    : ${opens}`);
      console.log(`      questions: ${qz.questions.length}`);
      console.log(`      pass mark: ${qz.passMark ?? 70}%`);
      console.log(`      attempts : ${qz.maxAttempts ?? 2}`);
      // Catch a bad answer key before anything is written — an out-of-range
      // index would otherwise seed a question with no correct option.
      const bad = qz.questions
        .map((q, i) => ({ i, correct: q.correct }))
        .filter(({ i, correct }) => {
          const n = qz.questions[i].options.length;
          return !Number.isInteger(correct) || correct < 0 || correct >= n;
        });
      if (bad.length) {
        throw new Error(
          `Quiz "${qz.slug}": correct index out of range for question(s) ${bad
            .map((b) => b.i + 1)
            .join(", ")}`
        );
      }
      const answers = qz.questions.map((q, i) => `${i + 1}:${"ABCDEF"[q.correct]}`).join(" ");
      console.log(`      answers  : ${answers}`);
    }
    console.log();
  }

  if (!APPLY) {
    console.log("Dry run — nothing written. Re-run with --apply.");
    return;
  }

  // Modules are matched on (courseId, weekNumber) so a re-run updates in place.
  // The schema has no unique constraint there, so find-then-write rather than
  // upsert; the seed is the only writer of these rows.
  for (const w of seed.weeks) {
    const releaseAt = atWat(w.releaseDate);
    const existing = await db.module.findFirst({
      where: { courseId: course.id, weekNumber: w.weekNumber },
      select: { id: true },
    });

    const data = {
      title: w.title,
      weekNumber: w.weekNumber,
      // Omitted rather than nulled. A quiz-only seed file carries no overview,
      // and writing null there would silently wipe the text a lessons file had
      // already set.
      ...(w.overview !== undefined ? { overview: w.overview } : {}),
      ...(w.objectives !== undefined ? { objectives: w.objectives } : {}),
      order: w.weekNumber,
      status: "PUBLISHED",
      releaseAt,
    };

    const mod = existing
      ? await db.module.update({ where: { id: existing.id }, data })
      : await db.module.create({ data: { ...data, courseId: course.id } });

    console.log(`${existing ? "updated" : "created"} week ${w.weekNumber}: ${mod.id}`);

    for (const [i, l] of (w.lessons ?? []).entries()) {
      const existingLesson = await db.lesson.findFirst({
        where: { moduleId: mod.id, order: i + 1 },
        select: { id: true },
      });
      const lessonData = {
        title: l.title,
        content: l.content ?? null,
        youtubeVideoId: l.youtubeVideoId ?? null,
        durationMin: l.durationMin ?? null,
        order: i + 1,
        releaseAt: l.releaseDate ? atWat(l.releaseDate) : null,
      };
      const lesson = existingLesson
        ? await db.lesson.update({ where: { id: existingLesson.id }, data: lessonData })
        : await db.lesson.create({ data: { ...lessonData, moduleId: mod.id } });

      if (l.pdf) {
        const existingRes = await db.lessonResource.findFirst({
          where: { lessonId: lesson.id, type: "PDF" },
          select: { id: true, documentId: true },
        });

        // Upload the bytes once. On a re-run the existing Document is reused
        // rather than re-inserted, so the file is not duplicated in the DB.
        let documentId = l.pdf.documentId ?? existingRes?.documentId ?? null;
        if (!documentId && l.pdf.localPath) {
          if (!existsSync(l.pdf.localPath)) throw new Error(`No PDF at ${l.pdf.localPath}`);
          const bytes = readFileSync(l.pdf.localPath);
          const doc = await db.document.create({
            data: {
              title: l.pdf.title,
              storagePath: `${Date.now()}-${l.pdf.title.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
              data: bytes,
              mimeType: "application/pdf",
              sizeBytes: bytes.length,
            },
          });
          documentId = doc.id;
          console.log(`      pdf: uploaded ${l.pdf.title} (${(bytes.length / 1024).toFixed(0)}KB) -> ${doc.id}`);
        }

        const resData = { title: l.pdf.title, type: "PDF", url: l.pdf.url ?? null, documentId };
        if (existingRes) await db.lessonResource.update({ where: { id: existingRes.id }, data: resData });
        else await db.lessonResource.create({ data: { ...resData, lessonId: lesson.id } });
      }
    }

    if (w.assignment) {
      const deadline = w.assignment.deadlineDate ? atWat(w.assignment.deadlineDate, 23, 59) : null;
      const aData = {
        title: w.assignment.title,
        description: w.assignment.description,
        instructions: w.assignment.instructions ?? null,
        requirements: w.assignment.requirements ?? null,
        deadline,
        releaseAt: w.assignment.releaseDate ? atWat(w.assignment.releaseDate) : null,
        allowedTypes: JSON.stringify(w.assignment.allowedTypes ?? ["PDF", "DOC", "DOCX", "ZIP", "IMAGE"]),
        maxAttempts: w.assignment.maxAttempts ?? 3,
        latePolicy: w.assignment.latePolicy ?? "ALLOW",
        maxFileSizeMb: w.assignment.maxFileSizeMb ?? 10,
      };
      const existingA = await db.assignment.findFirst({
        where: { moduleId: mod.id },
        select: { id: true },
      });
      if (existingA) await db.assignment.update({ where: { id: existingA.id }, data: aData });
      else await db.assignment.create({ data: { ...aData, moduleId: mod.id } });
    }

    for (const qz of weekQuizzes(w)) {
      const qzData = {
        title: qz.title,
        description: qz.description ?? null,
        passMark: qz.passMark ?? 70,
        maxAttempts: qz.maxAttempts ?? 2,
        status: "PUBLISHED",
        moduleId: mod.id,
        releaseAt: qz.releaseDate ? atWat(qz.releaseDate) : null,
      };
      // Keyed on the seed file's slug so re-running edits the same quiz instead
      // of creating a second one.
      const quiz = await db.quiz.upsert({
        where: { slug: qz.slug },
        update: qzData,
        create: { ...qzData, slug: qz.slug },
      });

      // Questions are replaced wholesale, matching the Intranet 101 seed: the
      // file is the single source of truth, and attempt history lives on
      // QuizAttempt (which stores chosen option ids) rather than here.
      await db.quizQuestion.deleteMany({ where: { quizId: quiz.id } });
      for (const [i, q] of qz.questions.entries()) {
        await db.quizQuestion.create({
          data: {
            quizId: quiz.id,
            prompt: q.prompt,
            explanation: q.explanation ?? null,
            order: i,
            options: {
              create: q.options.map((label, oi) => ({
                label,
                isCorrect: oi === q.correct,
                order: oi,
              })),
            },
          },
        });
      }
    }
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
