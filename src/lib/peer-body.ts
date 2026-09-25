import { db } from "./db";

/**
 * Peer Body — structured peer feedback circles.
 *
 * A round belongs to one course (or a whole pathway) and is opened by a
 * facilitator with a prompt. Students submit work, then review each other. The
 * review form is deliberately three short, kindness-forward fields rather than
 * a free-text box, which is what keeps feedback specific and usable.
 */

export type PeerBodyRoundSummary = {
  id: string;
  title: string;
  prompt: string;
  status: string;
  closesAt: Date | null;
  createdAt: Date;
  courseName: string | null;
  pathway: string | null;
  submissionCount: number;
  /** Whether the viewer has already submitted work to this round. */
  viewerSubmitted: boolean;
  /** Reviews the viewer has left in this round. */
  viewerReviews: number;
};

/** Rounds visible to a student: open rounds on their electives, plus any they
 *  already took part in (so a closed round stays reachable as an archive). */
export async function getStudentRounds(userId: string): Promise<PeerBodyRoundSummary[]> {
  const enrollments = await db.enrollment.findMany({
    where: { userId, status: "ACCEPTED" },
    select: { courseId: true, pathway: true },
  });
  const courseIds = enrollments.map((e) => e.courseId);
  const pathways = enrollments.map((e) => e.pathway).filter((p): p is string => Boolean(p));

  const rounds = await db.peerBodyRound.findMany({
    where: {
      OR: [
        { courseId: { in: courseIds } },
        ...(pathways.length ? [{ pathway: { in: pathways } }] : []),
        { submissions: { some: { authorId: userId } } },
      ],
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      prompt: true,
      status: true,
      closesAt: true,
      createdAt: true,
      pathway: true,
      course: { select: { name: true } },
      _count: { select: { submissions: true } },
      submissions: { where: { authorId: userId }, select: { id: true } },
    },
  });

  // Reviews the viewer left, grouped by round, in a single query.
  const myReviews = await db.peerBodyReview.findMany({
    where: { reviewerId: userId },
    select: { submission: { select: { roundId: true } } },
  });
  const viewerReviewsByRound = new Map<string, number>();
  for (const r of myReviews) {
    const roundId = r.submission.roundId;
    viewerReviewsByRound.set(roundId, (viewerReviewsByRound.get(roundId) ?? 0) + 1);
  }

  return rounds.map((r) => ({
    id: r.id,
    title: r.title,
    prompt: r.prompt,
    status: r.status,
    closesAt: r.closesAt,
    createdAt: r.createdAt,
    courseName: r.course?.name ?? null,
    pathway: r.pathway,
    submissionCount: r._count.submissions,
    viewerSubmitted: r.submissions.length > 0,
    viewerReviews: viewerReviewsByRound.get(r.id) ?? 0,
  }));
}

/** Full round detail for one student, with submissions and review state. */
export async function getRoundForStudent(roundId: string, viewerId: string) {
  const round = await db.peerBodyRound.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      title: true,
      prompt: true,
      status: true,
      closesAt: true,
      pathway: true,
      courseId: true,
      course: { select: { name: true } },
      facilitator: { select: { id: true, profile: { select: { fullName: true } } } },
    },
  });
  if (!round) return null;

  const submissions = await db.peerBodySubmission.findMany({
    where: { roundId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      body: true,
      linkUrl: true,
      createdAt: true,
      authorId: true,
      author: {
        select: {
          username: true,
          eliteMemberNumber: true,
          verificationTier: true,
          profile: { select: { fullName: true, avatarDocumentId: true } },
        },
      },
      reviews: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          whatLanded: true,
          oneSuggestion: true,
          oneQuestion: true,
          createdAt: true,
          reviewerId: true,
          reviewer: {
            select: { username: true, profile: { select: { fullName: true } } },
          },
        },
      },
    },
  });

  const shape = submissions.map((s) => ({
    ...s,
    isOwn: s.authorId === viewerId,
    // A student can't review their own work, and only reviews once.
    canReview: s.authorId !== viewerId && !s.reviews.some((r) => r.reviewerId === viewerId),
    reviews: s.reviews.map((r) => ({ ...r, isOwn: r.reviewerId === viewerId })),
  }));

  return { round, submissions: shape };
}

/** Reviews a student has received across every round, newest first. */
export async function getReviewsReceived(userId: string, limit = 20) {
  return db.peerBodyReview.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      whatLanded: true,
      oneSuggestion: true,
      oneQuestion: true,
      createdAt: true,
      reviewer: {
        select: { username: true, profile: { select: { fullName: true } } },
      },
      submission: {
        select: {
          title: true,
          round: { select: { id: true, title: true } },
        },
      },
    },
  });
}

/** Whether a student may review a submission: same round, not their own work. */
export async function canReviewSubmission(submissionId: string, reviewerId: string) {
  const submission = await db.peerBodySubmission.findUnique({
    where: { id: submissionId },
    select: { authorId: true },
  });
  if (!submission || submission.authorId === reviewerId) return false;
  const existing = await db.peerBodyReview.findUnique({
    where: { submissionId_reviewerId: { submissionId, reviewerId } },
    select: { id: true },
  });
  return !existing;
}
