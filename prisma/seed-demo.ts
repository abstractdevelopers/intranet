import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Demo content for the UCA Testing Intranet.
 *
 * A single week-1 module so nothing is gated behind a Captain's Log, holding the
 * video, the reading, the quiz and the document-upload assignment that testers
 * walk through. Idempotent: fixed IDs mean re-running updates in place.
 */
const COURSE_SLUG = "uca-testing-intranet";
const MODULE_ID = "demo-module-week-1";

const WELCOME = `Welcome to the UCA Testing Intranet.

You are one of the first people getting access to this version of the UCA Intranet, and your job is simple:

Use it. Break it. Test it. Tell us what doesn't work.

This is not an actual UCA course. It is a dummy course created specifically to test how the UCA learning system works.

During this course, you will test some of the features you will eventually use as a UCA student:

- Opening a course
- Watching an embedded course video
- Reading course instructions
- Completing a quiz
- Preparing your answers in a document
- Uploading your assignment
- Submitting your work for grading

Please complete the entire course rather than simply clicking through it.

COURSE INTRODUCTION

Before you begin, remember one thing: this course is about testing the system, not testing you.

There are no complicated questions here. Your goal is to go through the course exactly as you would if this were a real UCA lesson. Watch the video, read the lesson, complete the quiz, create your answer document and submit it through the assignment section.`;

const READING = `What Makes a Creator?

A creator is someone who takes an idea and turns it into something that other people can experience, use, learn from or connect with.

Creators can make videos, write, design, teach, build businesses, tell stories, create communities, develop products and solve problems.

But creating is not simply about producing something. A creator also needs to understand why they are creating.

Before creating anything, ask yourself three simple questions:

1. What am I creating?

Be clear about the thing you want to produce. It could be a video, article, design, campaign, product, presentation or any other form of creative work.

2. Who am I creating for?

Every piece of content or creative work has someone on the other side of it. Understanding the person you are creating for helps you make better decisions.

3. Why does it matter?

A creator should understand the purpose behind their work. What problem does it solve? What does it communicate? What does it make someone feel, understand or do?

The answers to these questions can help turn random creation into intentional creation.`;

const QUIZ = `Complete the quiz below. Answer the questions based on the lesson and the video.

Do not look for the answers online. This is a test of whether you understood the dummy lesson.

Question 1
According to the lesson, what are the three questions a creator should ask before creating something?

Question 2
Why is it important for a creator to understand who they are creating for?

Question 3
What is the difference between simply producing something and creating intentionally?

Question 4
Imagine you want to create a short video teaching students how to study better. Answer these three questions:

  What are you creating?
  Who are you creating it for?
  Why does it matter?

Question 5
In your own words, explain what you think makes someone a creator.

There is no single "perfect" answer to this question. We want to see how you understood the lesson.`;

const BONUS_QUIZ = `BONUS QUIZ

Question 6
What's the theme of the above video?

Question 7
What is the video about? (Explain in 30 words or less)

Question 8
Did you notice anything odd about the video?

HOW TO COMPLETE THE BONUS QUIZ

You do not need to type your answers directly into the intranet. Instead:

Step 1
Open a document using Microsoft Word, Google Docs, WPS Office, or any document application available to you.

Step 2
Create a document titled: UCA Dummy Course BONUS Quiz Submission

Step 3
Write your answers clearly. For example:

  Question 1:
  Your answer here.

  Question 2:
  Your answer here.

Continue until you have answered all the questions.

Step 4
Save the document as a PDF or DOCX file.

Step 5
Return to the intranet. Go to the Assignment Submission section of this course.

Step 6
Upload your completed document.

Step 7
Submit the assignment.

After submitting, confirm that the intranet shows your assignment as: Submitted / Awaiting Grading.

Do not worry if you cannot immediately see a score. In the real UCA system, assignments are manually graded, so scores may appear later.

IMPORTANT TESTING INSTRUCTION

While completing this dummy course, pay attention to the experience. If you notice anything that doesn't work properly, take note of it.

For example:

- A button doesn't work.
- A video doesn't load.
- A page doesn't open.
- Something is confusing.
- The assignment upload doesn't work.
- Your document doesn't upload.
- The submission status doesn't change.
- Your course doesn't mark as completed.
- Something looks strange on your phone.
- Something works on desktop but not mobile.
- You cannot find something you should be able to find.

Please report anything unusual. The purpose of giving you access is not just for you to complete the course — you're helping us test UCA before everyone enters.`;

const LESSONS = [
  {
    id: "demo-lesson-video",
    title: "Step 1 — Watch the course video",
    youtubeVideoId: "dQw4w9WgXcQ",
    durationMin: 4,
    order: 1,
    content: `Watch the dummy course explanation below, then move on to the lesson.

The video is part of the testing process, so please make sure the video actually opens and plays inside the intranet.`,
  },
  {
    id: "demo-lesson-reading",
    title: "Step 2 — Read the lesson",
    youtubeVideoId: null,
    durationMin: 5,
    order: 2,
    content: READING,
  },
  {
    id: "demo-lesson-quiz",
    title: "Step 3 — Complete the quiz",
    youtubeVideoId: null,
    durationMin: 5,
    order: 3,
    content: QUIZ,
  },
  {
    id: "demo-lesson-bonus",
    title: "Bonus quiz and assignment instructions",
    youtubeVideoId: null,
    durationMin: 3,
    order: 4,
    content: BONUS_QUIZ,
  },
];

async function main() {
  const course = await prisma.course.upsert({
    where: { slug: COURSE_SLUG },
    update: {
      name: "The Creator's Mindset",
      description:
        "UCA TESTING INTRANET — a dummy testing course. Use it. Break it. Test it. Tell us what doesn't work.",
      type: "ELECTIVE",
      isCompulsory: false,
      isActive: true,
      status: "PUBLISHED",
      price: 15_000,
      currency: "NGN",
      durationWeeks: 1,
      pathway: null,
    },
    create: {
      name: "The Creator's Mindset",
      slug: COURSE_SLUG,
      description:
        "UCA TESTING INTRANET — a dummy testing course. Use it. Break it. Test it. Tell us what doesn't work.",
      type: "ELECTIVE",
      isCompulsory: false,
      isActive: true,
      status: "PUBLISHED",
      price: 15_000,
      currency: "NGN",
      durationWeeks: 1,
      pathway: null,
    },
  });

  // Week 1 with no release date: open immediately, and no Captain's Log gate.
  const demoModule = await prisma.module.upsert({
    where: { id: MODULE_ID },
    update: {
      courseId: course.id,
      title: "UCA Testing Intranet — Course Walkthrough",
      overview: WELCOME,
      objectives:
        "Open a course, watch an embedded video, read instructions, complete a quiz, prepare a document, upload it and submit for grading.",
      weekNumber: 1,
      order: 1,
      status: "PUBLISHED",
      releaseAt: null,
    },
    create: {
      id: MODULE_ID,
      courseId: course.id,
      title: "UCA Testing Intranet — Course Walkthrough",
      overview: WELCOME,
      objectives:
        "Open a course, watch an embedded video, read instructions, complete a quiz, prepare a document, upload it and submit for grading.",
      weekNumber: 1,
      order: 1,
      status: "PUBLISHED",
      releaseAt: null,
    },
  });

  await prisma.lesson.deleteMany({ where: { moduleId: demoModule.id } });
  for (const lesson of LESSONS) {
    await prisma.lesson.create({ data: { ...lesson, moduleId: demoModule.id } });
  }

  await prisma.assignment.upsert({
    where: { id: "demo-assignment-bonus-quiz" },
    update: {
      moduleId: demoModule.id,
      title: "UCA Dummy Course BONUS Quiz Submission",
      description:
        "Upload your completed bonus quiz document (Questions 1–8) as a PDF or DOCX file.",
      instructions:
        "Create a document titled \"UCA Dummy Course BONUS Quiz Submission\", answer every question clearly, then save it as a PDF or DOCX and upload it here.",
      requirements: "A single PDF or DOCX document containing your answers to all eight questions.",
      allowedTypes: JSON.stringify(["PDF", "DOC", "DOCX"]),
      maxFileSizeMb: 4,
      maxAttempts: 5,
      latePolicy: "ALLOW",
      deadline: null,
    },
    create: {
      id: "demo-assignment-bonus-quiz",
      moduleId: demoModule.id,
      title: "UCA Dummy Course BONUS Quiz Submission",
      description:
        "Upload your completed bonus quiz document (Questions 1–8) as a PDF or DOCX file.",
      instructions:
        "Create a document titled \"UCA Dummy Course BONUS Quiz Submission\", answer every question clearly, then save it as a PDF or DOCX and upload it here.",
      requirements: "A single PDF or DOCX document containing your answers to all eight questions.",
      allowedTypes: JSON.stringify(["PDF", "DOC", "DOCX"]),
      maxFileSizeMb: 4,
      maxAttempts: 5,
      latePolicy: "ALLOW",
      deadline: null,
    },
  });

  // Give every active student access, so the testing course is usable at once.
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", status: "ACTIVE" },
    select: { id: true, email: true },
  });

  for (const student of students) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: student.id, courseId: course.id } },
      update: { status: "ACCEPTED" },
      create: {
        userId: student.id,
        courseId: course.id,
        status: "ACCEPTED",
        enrollmentType: "ELECTIVE",
        approvedAt: new Date(),
        startedAt: new Date(),
      },
    });
  }

  console.log("Demo content ready:");
  console.log(`  Course: ${course.name} (${course.slug})`);
  console.log(`  Module: ${demoModule.title} — week 1, published, no release gate`);
  console.log(`  Lessons: ${LESSONS.length} (video, reading, quiz, bonus + instructions)`);
  console.log("  Assignment: UCA Dummy Course BONUS Quiz Submission (PDF/DOC/DOCX)");
  console.log(`  Enrolled ACCEPTED: ${students.length} student(s)`);
  for (const s of students) console.log(`    - ${s.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());