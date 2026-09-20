import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOnboardedStudentApi } from "@/lib/rbac";
import { resolveWritablePathway } from "@/lib/discussions";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().trim().max(140).optional(),
  body: z.string().trim().min(2, "Write something before posting.").max(5000),
  // null/absent = the general academy feed.
  pathway: z.string().trim().max(60).nullable().optional(),
});

/** Start a discussion in the general feed or the student's own pathway feed. */
export async function POST(request: Request) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const user = guard.user;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Scoping is re-derived server-side; the client's claimed pathway is only a
  // request, never a grant.
  const scope = await resolveWritablePathway(user.id, parsed.data.pathway);
  if (!scope.ok) return NextResponse.json({ error: scope.reason }, { status: 403 });

  const post = await db.discussionPost.create({
    data: {
      authorId: user.id,
      pathway: scope.pathway,
      title: parsed.data.title?.length ? parsed.data.title : null,
      body: parsed.data.body,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: post.id });
}