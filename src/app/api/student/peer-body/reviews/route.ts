import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOnboardedStudentApi } from "@/lib/rbac";
import { PEER_BODY_STATUS } from "@/lib/constants";
import { notify } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  submissionId: z.string().trim().min(1),
  whatLanded: z.string().trim().min(3, "Say what worked.").max(2000),
  oneSuggestion: z.string().trim().min(3, "Offer one thing to try.").max(2000),
  oneQuestion: z.string().trim().max(2000).optional().or(z.literal("")),
});

/** Leave a peer review on someone else's submission in the same round. */
export async function POST(request: Request) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const user = guard.user;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { submissionId, whatLanded, oneSuggestion, oneQuestion } = parsed.data;

  const submission = await db.peerBodySubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      authorId: true,
      title: true,
      round: { select: { id: true, title: true, status: true } },
    },
  });
  if (!submission) {
    return NextResponse.json({ error: "That submission isn't available." }, { status: 404 });
  }
  if (submission.round.status !== PEER_BODY_STATUS.REVIEWING) {
    return NextResponse.json({ error: "This round has closed." }, { status: 403 });
  }
  if (submission.authorId === user.id) {
    return NextResponse.json(
      { error: "You can't review your own work — that's what the facilitator is for." },
      { status: 403 }
    );
  }

  const existing = await db.peerBodyReview.findUnique({
    where: { submissionId_reviewerId: { submissionId, reviewerId: user.id } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "You've already reviewed this one." }, { status: 409 });
  }

  const review = await db.peerBodyReview.create({
    data: {
      submissionId,
      reviewerId: user.id,
      authorId: submission.authorId,
      whatLanded,
      oneSuggestion,
      oneQuestion: oneQuestion || null,
    },
    select: { id: true },
  });

  await notify({
    userId: submission.authorId,
    type: "PEER_BODY_REVIEW",
    title: "New peer review on your work",
    body: `${user.fullName} reviewed “${submission.title}”.`,
    metadata: { reviewId: review.id, roundId: submission.round.id, url: `/student/peer-body/${submission.round.id}` },
  }).catch((err) => console.error("[peer-body:notify]", err));

  return NextResponse.json({ ok: true, id: review.id });
}
