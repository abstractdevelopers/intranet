import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOnboardedStudentApi } from "@/lib/rbac";
import { PEER_BODY_STATUS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const schema = z.object({
  roundId: z.string().trim().min(1),
  title: z.string().trim().min(2, "Give your piece a title.").max(160),
  body: z
    .string()
    .trim()
    .min(10, "Describe your work in a sentence or two.")
    .max(8000),
  linkUrl: z.string().trim().url("That link doesn't look right.").max(500).optional().or(z.literal("")),
});

/** Submit (or update) the viewer's work in a round. One submission per round. */
export async function POST(request: Request) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const user = guard.user;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { roundId, title, body, linkUrl } = parsed.data;

  const round = await db.peerBodyRound.findUnique({
    where: { id: roundId },
    select: { id: true, status: true, courseId: true },
  });
  if (!round) return NextResponse.json({ error: "That round doesn't exist." }, { status: 404 });
  if (round.status !== PEER_BODY_STATUS.REVIEWING) {
    return NextResponse.json({ error: "This round has closed." }, { status: 403 });
  }

  // Only students enrolled on the round's course may take part. A round with no
  // course is academy-wide, so any onboarded student may join it.
  if (round.courseId) {
    const enrolled = await db.enrollment.findFirst({
      where: { userId: user.id, courseId: round.courseId, status: "ACCEPTED" },
      select: { id: true },
    });
    if (!enrolled) {
      return NextResponse.json(
        { error: "This round is for students on that course." },
        { status: 403 }
      );
    }
  }

  const submission = await db.peerBodySubmission.upsert({
    where: { roundId_authorId: { roundId, authorId: user.id } },
    update: { title, body, linkUrl: linkUrl || null },
    create: { roundId, authorId: user.id, title, body, linkUrl: linkUrl || null },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: submission.id });
}
