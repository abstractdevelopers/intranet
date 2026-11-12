import { Prisma } from "@prisma/client";
import { db } from "./db";
import {
  ASSESSMENT_CLOSES_AT,
  ASSESSMENT_OPENS_AT,
  QUESTION_KIND,
  type AssessmentKind,
  type QuestionKind,
} from "./constants";

/**
 * End-of-term assessments.
 *
 * Two papers per student — one THEORY, one PRACTICAL — matched to their
 * pathway. Theory answers are graded on the server: MCQ questions from
 * `AssessmentOption.isCorrect`, written (TEXT) questions by staff. Correct
 * answers are never included in anything sent to the browser, exactly as the
 * quiz runner does for Intranet 101.
 *
 * The submission window is enforced here, on the server, on every read and
 * write. The UI only reflects it.
 */

export type AssessmentWindow = {
  opensAt: Date;
  closesAt: Date;
  /** Before the window opened. */
  upcoming: boolean;
  /** Past the deadline — the hard cut-off. */
  closed: boolean;
  open: boolean;
};

export type AssessmentQuestionView = {
  id: string;
  kind: QuestionKind;
  prompt: string;
  points: number;
  order: number;
  options: { id: string; label: string; order: number }[];
};

export type AssessmentView = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  instructions: string | null;
  kind: AssessmentKind;
  pathway: string | null;
  maxScore: number;
  passMark: number;
  window: AssessmentWindow;
  questions: AssessmentQuestionView[];
  /** Total points available (theory). 0 for a practical paper. */
  totalPoints: number;
  submission: {
    status: string;
    submittedAt: Date;
    /** Written answer per TEXT question, and chosen option id per MCQ. */
    answers: Record<string, string>;
    textContent: string | null;
    externalUrl: string | null;
    files: { id: string; documentId: string; fileName: string }[];
    score: number | null;
    autoScore: number | null;
    feedback: string | null;
    gradedAt: Date | null;
  } | null;
};

export type AssessmentSubmitResult =
  | { ok: true; score: number | null; autoScore: number | null; graded: boolean }
  | { ok: false; error: string; status: number };

/** The window a paper runs on, falling back to the academy-wide dates. */
export function assessmentWindow(
  assessment: { openAt: Date | null; closeAt: Date | null },
  now: Date = new Date()
): AssessmentWindow {
  const opensAt = assessment.openAt ?? ASSESSMENT_OPENS_AT;
  const closesAt = assessment.closeAt ?? ASSESSMENT_CLOSES_AT;
  const upcoming = now < opensAt;
  const closed = now > closesAt;
  return { opensAt, closesAt, upcoming, closed, open: !upcoming && !closed };
}

/** The pathway a student is enrolled under, read from their elective. */
export async function pathwayForUser(userId: string): Promise<string | null> {
  const enrollment = await db.enrollment.findFirst({
    where: { userId, enrollmentType: "ELECTIVE", status: "ACCEPTED" },
    select: { pathway: true, course: { select: { pathway: true } } },
  });
  return enrollment?.pathway ?? enrollment?.course.pathway ?? null;
}

/**
 * The published paper of `kind` for a student. A paper written for their exact
 * pathway wins; a pathway-agnostic paper (pathway null) is the fallback.
 */
async function findPaper(userId: string, kind: AssessmentKind) {
  const pathway = await pathwayForUser(userId);
  const candidates = await db.assessment.findMany({
    where: {
      kind,
      status: "PUBLISHED",
      OR: [{ pathway }, { pathway: null }],
    },
    select: { id: true, pathway: true },
  });
  if (candidates.length === 0) return null;
  const exact = candidates.find((c) => c.pathway === pathway);
  return (exact ?? candidates[0]).id;
}

type RawQuestion = {
  id: string;
  kind: string;
  prompt: string;
  points: number;
  order: number;
  options: { id: string; label: string; order: number }[];
};

/** Strip correct answers and attach this student's submission state. */
async function buildView(assessmentId: string, userId: string): Promise<AssessmentView | null> {
  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          kind: true,
          prompt: true,
          points: true,
          order: true,
          options: {
            orderBy: { order: "asc" },
            // Deliberately no isCorrect — this shape reaches the browser.
            select: { id: true, label: true, order: true },
          },
        },
      },
      submissions: {
        where: { userId },
        include: { files: { select: { id: true, documentId: true, fileName: true } } },
      },
    },
  });
  if (!assessment || assessment.status !== "PUBLISHED") return null;

  const questions = assessment.questions as RawQuestion[];
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  const submission = assessment.submissions[0] ?? null;

  const storedAnswers =
    submission && submission.answers && typeof submission.answers === "object"
      ? (submission.answers as Record<string, string>)
      : {};

  return {
    id: assessment.id,
    slug: assessment.slug,
    title: assessment.title,
    description: assessment.description,
    instructions: assessment.instructions,
    kind: assessment.kind as AssessmentKind,
    pathway: assessment.pathway,
    maxScore: assessment.maxScore,
    passMark: assessment.passMark,
    window: assessmentWindow(assessment),
    questions: questions.map((q) => ({
      id: q.id,
      kind: q.kind as QuestionKind,
      prompt: q.prompt,
      points: q.points,
      order: q.order,
      options: q.options,
    })),
    totalPoints,
    submission: submission
      ? {
          status: submission.status,
          submittedAt: submission.submittedAt,
          answers: storedAnswers,
          textContent: submission.textContent,
          externalUrl: submission.externalUrl,
          files: submission.files,
          score: submission.score,
          autoScore: submission.autoScore,
          feedback: submission.feedback,
          gradedAt: submission.gradedAt,
        }
      : null,
  };
}

/** Both papers for a student, keyed by kind. Missing papers come back null. */
export async function getStudentAssessments(userId: string): Promise<{
  theory: AssessmentView | null;
  practical: AssessmentView | null;
}> {
  const [theoryId, practicalId] = await Promise.all([
    findPaper(userId, "THEORY"),
    findPaper(userId, "PRACTICAL"),
  ]);
  const [theory, practical] = await Promise.all([
    theoryId ? buildView(theoryId, userId) : null,
    practicalId ? buildView(practicalId, userId) : null,
  ]);
  return { theory, practical };
}

/** A single paper by id, for the detail pages. */
export async function getAssessmentView(assessmentId: string, userId: string) {
  return buildView(assessmentId, userId);
}

/**
 * The MCQ-only percentage of a theory paper: earned points over MCQ points.
 * Returns null when the paper has no MCQ questions.
 */
function mcqScore(
  questions: { id: string; kind: string; points: number; options: { id: string; isCorrect: boolean }[] }[],
  answers: Record<string, string>
): number | null {
  const mcq = questions.filter((q) => q.kind === QUESTION_KIND.MCQ);
  if (mcq.length === 0) return null;
  const total = mcq.reduce((sum, q) => sum + q.points, 0);
  let earned = 0;
  for (const q of mcq) {
    const correct = q.options.find((o) => o.isCorrect);
    if (correct && answers[q.id] === correct.id) earned += q.points;
  }
  return total === 0 ? 0 : round1((earned / total) * 100);
}

/**
 * The full theory percentage: MCQ points plus staff marks for written
 * questions, over the paper total. Returns null if any written question is
 * still unmarked, so a partly-marked paper never reports a misleading score.
 */
export function theoryScore(
  questions: { id: string; kind: string; points: number; options: { id: string; isCorrect: boolean }[] }[],
  answers: Record<string, string>,
  marks: Record<string, number>
): number | null {
  const total = questions.reduce((sum, q) => sum + q.points, 0);
  if (total === 0) return 0;
  let earned = 0;
  for (const q of questions) {
    if (q.kind === QUESTION_KIND.MCQ) {
      const correct = q.options.find((o) => o.isCorrect);
      if (correct && answers[q.id] === correct.id) earned += q.points;
    } else {
      const mark = marks[q.id];
      if (typeof mark !== "number") return null; // not yet marked
      earned += Math.max(0, Math.min(q.points, mark));
    }
  }
  return round1((earned / total) * 100);
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function hasWrittenQuestions(questions: { kind: string }[]) {
  return questions.some((q) => q.kind === QUESTION_KIND.TEXT);
}

/**
 * Record a theory submission.
 *
 * Enforces the window and grades the MCQ answers immediately. A paper with only
 * MCQ questions is fully graded on submit; one with written answers stays
 * SUBMITTED until staff mark it. Upserted, so a student may revise freely until
 * the deadline.
 */
export async function submitTheory(
  userId: string,
  assessmentId: string,
  answers: Record<string, string>
): Promise<AssessmentSubmitResult> {
  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    include: { questions: { include: { options: true } } },
  });
  if (!assessment || assessment.status !== "PUBLISHED" || assessment.kind !== "THEORY") {
    return { ok: false, error: "This assessment isn't available.", status: 404 };
  }

  const window = assessmentWindow(assessment);
  if (window.upcoming) {
    return { ok: false, error: "This assessment hasn't opened yet.", status: 403 };
  }
  if (window.closed) {
    return { ok: false, error: "The submission deadline has passed.", status: 403 };
  }

  // Only keep answers for questions that belong to this paper.
  const clean: Record<string, string> = {};
  for (const q of assessment.questions) {
    const value = answers[q.id];
    if (typeof value === "string" && value.trim()) clean[q.id] = value;
  }

  const autoScore = mcqScore(assessment.questions, clean);
  const written = hasWrittenQuestions(assessment.questions);
  // With no written answers there is nothing for staff to mark, so the paper is
  // graded on the spot.
  const score = written ? null : theoryScore(assessment.questions, clean, {});
  const status = written ? "SUBMITTED" : "GRADED";

  await db.assessmentSubmission.upsert({
    where: { assessmentId_userId: { assessmentId, userId } },
    create: {
      assessmentId,
      userId,
      status,
      answers: clean,
      autoScore,
      score,
      gradedAt: written ? null : new Date(),
    },
    update: {
      status,
      answers: clean,
      autoScore,
      score,
      marks: Prisma.JsonNull,
      gradedById: null,
      gradedAt: written ? null : new Date(),
      feedback: null,
      submittedAt: new Date(),
    },
  });

  return { ok: true, score, autoScore, graded: !written };
}

/**
 * Record a practical submission: a written response, a hosted link, or uploaded
 * files. The paper is marked by staff, so it stays SUBMITTED.
 */
export async function submitPractical(
  userId: string,
  assessmentId: string,
  input: {
    textContent?: string | null;
    externalUrl?: string | null;
    files?: { documentId: string; fileName: string }[];
  }
): Promise<AssessmentSubmitResult> {
  const assessment = await db.assessment.findUnique({ where: { id: assessmentId } });
  if (!assessment || assessment.status !== "PUBLISHED" || assessment.kind !== "PRACTICAL") {
    return { ok: false, error: "This assessment isn't available.", status: 404 };
  }

  const window = assessmentWindow(assessment);
  if (window.upcoming) return { ok: false, error: "This assessment hasn't opened yet.", status: 403 };
  if (window.closed) return { ok: false, error: "The submission deadline has passed.", status: 403 };

  const textContent = input.textContent?.trim() || null;
  const externalUrl = input.externalUrl?.trim() || null;
  const files = input.files ?? [];
  if (!textContent && !externalUrl && files.length === 0) {
    return { ok: false, error: "Add your work — a response, a link, or a file.", status: 400 };
  }

  await db.$transaction(async (tx) => {
    const existing = await tx.assessmentSubmission.findUnique({
      where: { assessmentId_userId: { assessmentId, userId } },
      select: { id: true },
    });
    const data = {
      status: "SUBMITTED",
      textContent,
      externalUrl,
      score: null,
      gradedById: null,
      gradedAt: null,
      feedback: null,
      submittedAt: new Date(),
    };
    const submission = existing
      ? await tx.assessmentSubmission.update({ where: { id: existing.id }, data })
      : await tx.assessmentSubmission.create({ data: { assessmentId, userId, ...data } });

    // Replace files wholesale so a resubmission never accumulates stale ones.
    await tx.assessmentSubmissionFile.deleteMany({ where: { submissionId: submission.id } });
    if (files.length > 0) {
      await tx.assessmentSubmissionFile.createMany({
        data: files.map((f) => ({
          submissionId: submission.id,
          documentId: f.documentId,
          fileName: f.fileName,
        })),
      });
    }
  });

  return { ok: true, score: null, autoScore: null, graded: false };
}

/**
 * Mark a theory paper's written answers. `marks` maps question id to points
 * awarded; MCQ questions are auto-scored and ignored here. The final percentage
 * is recomputed and the row moves to GRADED.
 */
export async function gradeTheorySubmission(input: {
  submissionId: string;
  staffId: string;
  marks: Record<string, number>;
  feedback?: string | null;
}) {
  const submission = await db.assessmentSubmission.findUnique({
    where: { id: input.submissionId },
    include: { assessment: { include: { questions: { include: { options: true } } } } },
  });
  if (!submission) throw new Error("Submission not found.");

  const answers =
    submission.answers && typeof submission.answers === "object"
      ? (submission.answers as Record<string, string>)
      : {};
  const score = theoryScore(submission.assessment.questions, answers, input.marks);

  return db.assessmentSubmission.update({
    where: { id: submission.id },
    data: {
      marks: input.marks,
      score,
      status: "GRADED",
      gradedById: input.staffId,
      gradedAt: new Date(),
      feedback: input.feedback?.trim() || null,
    },
  });
}

/** Mark a practical paper out of its max score. */
export async function gradePracticalSubmission(input: {
  submissionId: string;
  staffId: string;
  score: number;
  feedback?: string | null;
}) {
  const submission = await db.assessmentSubmission.findUnique({
    where: { id: input.submissionId },
    include: { assessment: { select: { maxScore: true } } },
  });
  if (!submission) throw new Error("Submission not found.");

  const max = submission.assessment.maxScore || 100;
  const clamped = Math.max(0, Math.min(max, input.score));
  const percent = round1((clamped / max) * 100);

  return db.assessmentSubmission.update({
    where: { id: submission.id },
    data: {
      score: percent,
      status: "GRADED",
      gradedById: input.staffId,
      gradedAt: new Date(),
      feedback: input.feedback?.trim() || null,
    },
  });
}
