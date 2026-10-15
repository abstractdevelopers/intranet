/**
 * Attaches the Graphics Design Week 2 assignment's reference design.
 *
 * The reference is an image, and the assignment page renders only text
 * (description / instructions / requirements) with no image slot, and the schema
 * cannot be changed. So the image is attached the only way the app supports: a
 * LessonResource of type IMAGE pointing at the protected document endpoint, which
 * lesson-view.tsx renders as a link that opens the full-size image.
 *
 * It is deliberately attached to an EXISTING lesson rather than added as a new
 * one. Week completion is `totalLessons > 0 && doneLessons === totalLessons`, so a
 * ninth lesson would drop the four students already at 8/8 back to incomplete and
 * lock the next week behind a lesson they had no reason to expect.
 *
 * A short pointer is prepended to the assignment instructions, because they tell
 * students the reference is "provided below" and nothing renders it there.
 *
 *   npx tsx scripts/attach-graphics-reference.ts            # dry run
 *   npx tsx scripts/attach-graphics-reference.ts --apply
 */
import { readFile } from "fs/promises";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const COURSE_SLUG = "graphics-design";
const WEEK = 2;
const LESSON_TITLE = "Part 1 — Layout & Composition";
const IMAGE_PATH = "content/assets/graphics-design-m1-week2-reference.jpg";
const DOC_TITLE = "Graphics Design — Module 1 Week 2 Assignment Reference";
const RESOURCE_TITLE = "Assignment Reference — Recreate, Reimagine & Design";

const POINTER =
  "REFERENCE DESIGN — WHERE TO FIND IT\n\n" +
  "The reference design you must study and recreate is attached to this week's lesson: " +
  `Week ${WEEK} → "${LESSON_TITLE}" → Resources. Open it before you begin Step 1.\n\n` +
  "---\n\n";

async function main() {
  const course = await db.course.findUnique({ where: { slug: COURSE_SLUG }, select: { id: true, name: true } });
  if (!course) throw new Error(`course not found: ${COURSE_SLUG}`);

  const lesson = await db.lesson.findFirst({
    where: { title: LESSON_TITLE, module: { courseId: course.id, weekNumber: WEEK } },
    select: { id: true, title: true, moduleId: true },
  });
  if (!lesson) throw new Error(`lesson not found: ${LESSON_TITLE}`);

  const assignment = await db.assignment.findFirst({
    where: { module: { courseId: course.id, weekNumber: WEEK } },
    select: { id: true, title: true, instructions: true },
  });
  if (!assignment) throw new Error("assignment not found");

  const bytes = await readFile(IMAGE_PATH);

  console.log(`Course      : ${course.name}`);
  console.log(`Lesson      : "${lesson.title}" (${lesson.id})`);
  console.log(`Assignment  : "${assignment.title}"`);
  console.log(`Image       : ${IMAGE_PATH} (${(bytes.length / 1024).toFixed(1)} KB)`);

  const existingDoc = await db.document.findFirst({ where: { title: DOC_TITLE }, select: { id: true } });
  const existingRes = await db.lessonResource.findFirst({
    where: { lessonId: lesson.id, title: RESOURCE_TITLE },
    select: { id: true },
  });
  const alreadyPointed = assignment.instructions?.startsWith("REFERENCE DESIGN — WHERE TO FIND IT") ?? false;

  console.log(`\nDocument    : ${existingDoc ? `exists (${existingDoc.id})` : "will be created"}`);
  console.log(`Resource    : ${existingRes ? `exists (${existingRes.id})` : "will be created"}`);
  console.log(`Pointer     : ${alreadyPointed ? "already present" : "will be prepended to instructions"}`);

  if (!APPLY) {
    console.log("\nDry run — nothing written. Re-run with --apply.");
    return;
  }

  const author = await db.user.findFirst({
    where: { role: { in: ["FOUNDER", "SUPER_ADMIN"] } },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });
  if (!author) throw new Error("no FOUNDER/SUPER_ADMIN to attribute the upload to");

  const doc = existingDoc
    ? await db.document.update({
        where: { id: existingDoc.id },
        data: { data: bytes, mimeType: "image/jpeg", sizeBytes: bytes.length },
        select: { id: true },
      })
    : await db.document.create({
        data: {
          title: DOC_TITLE,
          storagePath: "graphics-design-m1-week2-reference.jpg",
          data: bytes,
          mimeType: "image/jpeg",
          sizeBytes: bytes.length,
          uploadedById: author.id,
        },
        select: { id: true },
      });

  // `documentId` is set so the row is a first-class document, and `url` is set
  // because lesson-view only links documents directly for type PDF; an image
  // needs an explicit href or it renders as "#".
  const resource = existingRes
    ? await db.lessonResource.update({
        where: { id: existingRes.id },
        data: { type: "IMAGE", url: `/api/documents/${doc.id}`, documentId: doc.id },
        select: { id: true },
      })
    : await db.lessonResource.create({
        data: {
          lessonId: lesson.id,
          title: RESOURCE_TITLE,
          type: "IMAGE",
          url: `/api/documents/${doc.id}`,
          documentId: doc.id,
        },
        select: { id: true },
      });

  if (!alreadyPointed) {
    await db.assignment.update({
      where: { id: assignment.id },
      data: { instructions: POINTER + (assignment.instructions ?? "") },
    });
  }

  await db.auditLog.create({
    data: {
      actorId: author.id,
      action: "RESOURCE_ADDED",
      targetType: "Lesson",
      targetId: lesson.id,
      metadata: JSON.stringify({
        documentId: doc.id,
        resourceId: resource.id,
        via: "scripts/attach-graphics-reference.ts",
      }),
    },
  });

  console.log(`\nDocument ${doc.id}, resource ${resource.id} on "${lesson.title}" (author ${author.email}).`);
  console.log(alreadyPointed ? "Pointer already present." : "Pointer prepended to assignment instructions.");
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
