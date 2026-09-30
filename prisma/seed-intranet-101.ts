/**
 * Intranet 101 — the academy-wide intro assessment.
 *
 * Standalone: not attached to a course, compulsory for every student. Idempotent
 * — re-running replaces the questions so the content can be edited here and
 * re-seeded without touching attempts already recorded.
 */
import { PrismaClient } from "@prisma/client";
import { INTRANET_101_SLUG } from "../src/lib/intranet-101";

const db = new PrismaClient();

const QUESTIONS: { prompt: string; options: string[]; correct: number; explanation: string }[] = [
  {
    prompt: "In summary, what is the UCA Intranet?",
    options: [
      "A website for UCA announcements only",
      "A mini version of the internet built specifically for UCA — your creator workspace for courses, community, projects, portfolio, and more",
      "A social media platform for chatting with friends",
      "A website where you only submit assignments",
    ],
    correct: 1,
    explanation:
      "It's a mini internet built for UCA — courses, community, projects and portfolio in one workspace.",
  },
  {
    prompt: "What is the Captain's Log used for?",
    options: [
      "To track your login history",
      "To submit your weekly review — your experience, what you learned, who helped you, who you helped, challenges, and more",
      "To find people in your pathway",
      "To take your bi-weekly test",
    ],
    correct: 1,
    explanation: "The Captain's Log is your weekly review of the week that just passed.",
  },
  {
    prompt: "How often do UCA tests take place?",
    options: ["Every week", "Every month", "Every two weeks", "Only at the end of the academy"],
    correct: 2,
    explanation: "Tests run every two weeks — bi-weekly.",
  },
  {
    prompt: "If you want to find specific people or creators on UCA, where do you go?",
    options: ["Dashboard", "Community", "Discover", "Studio Wall"],
    correct: 2,
    explanation: "Discover is the creator directory.",
  },
  {
    prompt: "After clicking \u201cDiscover,\u201d how can you find creators?",
    options: [
      "Only by their username",
      "By searching their name or filtering by pathway",
      "Only through the Community section",
      "By checking your Captain's Log",
    ],
    correct: 1,
    explanation: "Search by name, or filter by pathway.",
  },
  {
    prompt: "How can you join a UCA community?",
    options: [
      "Only through the Community button on the panel",
      "Only through the Dashboard",
      "Through the Community section on the Dashboard or the Community section on the panel",
      "You are automatically added to every community",
    ],
    correct: 2,
    explanation: "Either route works — Dashboard or the side panel.",
  },
  {
    prompt: "What is the Studio Wall about?",
    options: [
      "A place to submit assignments",
      "A declaration wall where you state what you want to achieve or leave with from UCA and can revisit your \u201cwhy\u201d throughout your journey",
      "A place to take tests",
      "A directory of all UCA creators",
    ],
    correct: 1,
    explanation:
      "It's the declaration wall — you state what you want to leave UCA with, and revisit your why.",
  },
];

async function main() {
  const quiz = await db.quiz.upsert({
    where: { slug: INTRANET_101_SLUG },
    create: {
      slug: INTRANET_101_SLUG,
      title: "UCA Intranet 101 — Short Assessment",
      description:
        "Confirm you understand how to navigate the intranet. Two attempts; you need 70% to pass.",
      passMark: 70,
      maxAttempts: 2,
      isRequired: true,
      status: "PUBLISHED",
    },
    update: {
      title: "UCA Intranet 101 — Short Assessment",
      description:
        "Confirm you understand how to navigate the intranet. Two attempts; you need 70% to pass.",
      passMark: 70,
      maxAttempts: 2,
      isRequired: true,
      status: "PUBLISHED",
    },
  });

  // Replace questions wholesale so edits here are the single source of truth.
  await db.quizQuestion.deleteMany({ where: { quizId: quiz.id } });
  for (const [index, q] of QUESTIONS.entries()) {
    await db.quizQuestion.create({
      data: {
        quizId: quiz.id,
        prompt: q.prompt,
        explanation: q.explanation,
        order: index,
        options: {
          create: q.options.map((label, i) => ({
            label,
            isCorrect: i === q.correct,
            order: i,
          })),
        },
      },
    });
  }

  console.log(`Seeded "${quiz.title}" (${QUESTIONS.length} questions, pass ${quiz.passMark}%).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
