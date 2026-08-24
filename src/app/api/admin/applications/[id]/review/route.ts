import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { canReviewApplications } from "@/lib/rbac";
import { EnrollmentError, reviewElective } from "@/lib/enrollment";
import { auditLog } from "@/lib/audit";

const schema = z.object({ decision: z.enum(["APPROVED", "REJECTED"]) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || !canReviewApplications(user.role)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid decision." }, { status: 400 });
  }

  try {
    await reviewElective({
      applicationId: id,
      reviewerId: user.id,
      decision: parsed.data.decision,
    });
    await auditLog({
      actorId: user.id,
      action: parsed.data.decision === "APPROVED" ? "APPLICATION_APPROVED" : "APPLICATION_REJECTED",
      targetType: "Application",
      targetId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof EnrollmentError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[uca] application review failed", error);
    return NextResponse.json(
      { error: "We couldn't complete that action. Please try again." },
      { status: 500 }
    );
  }
}
