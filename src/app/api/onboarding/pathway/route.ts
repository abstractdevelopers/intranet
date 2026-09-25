import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { EnrollmentError, enrollInPathway, hasProgramme } from "@/lib/enrollment";
import { isPathwayAutoApprovalActive } from "@/lib/constants";
import { claimEliteStatus } from "@/lib/elite";
import { auditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({ electiveCourseId: z.string().min(1, "Please choose a pathway.") });

/**
 * Choose a pathway during account reclaim, enrolled immediately.
 *
 * The auto-approval allowance is time-boxed (see PATHWAY_AUTO_APPROVAL_UNTIL)
 * and enforced here, not just in the UI: once it lapses, this endpoint refuses
 * and the creator goes through the normal application flow instead.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  if (!isPathwayAutoApprovalActive()) {
    return NextResponse.json(
      {
        error: "Pathway self-selection has closed. Please apply to the academy.",
        redirect: "/student/apply",
      },
      { status: 403 }
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // One pathway per creator: once enrolled, this is not a re-pick. Changing a
  // pathway stays a deliberate staff action, so we refuse a silent overwrite.
  if (await hasProgramme(user.id)) {
    return NextResponse.json(
      { error: "You're already enrolled on a pathway.", redirect: "/student" },
      { status: 409 }
    );
  }

  try {
    const { pathway } = await enrollInPathway({
      userId: user.id,
      electiveCourseId: parsed.data.electiveCourseId,
    });
    // The reclaim flow is now complete, so this is the moment the Elite rank is
    // decided: the first ELITE_BADGE_LIMIT creators to get here keep it.
    const eliteMemberNumber = await claimEliteStatus(user.id);
    await auditLog({
      actorId: user.id,
      action: "PATHWAY_SELF_SELECTED",
      targetType: "User",
      targetId: user.id,
      metadata: { pathway, eliteMemberNumber },
    });
    return NextResponse.json({ ok: true, redirect: "/student", eliteMemberNumber });
  } catch (error) {
    if (error instanceof EnrollmentError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[uca] pathway selection failed", error);
    return NextResponse.json(
      { error: "We couldn't set your pathway. Please try again." },
      { status: 500 }
    );
  }
}

/** The elective courses a creator can choose from, for the picker. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const courses = await db.course.findMany({
    where: { type: "ELECTIVE", isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, description: true, slug: true, pathway: true, price: true },
  });

  return NextResponse.json({ courses, autoApprovalActive: isPathwayAutoApprovalActive() });
}
