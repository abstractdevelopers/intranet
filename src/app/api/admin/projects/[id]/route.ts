import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog, notify } from "@/lib/audit";

const schema = z.object({
  action: z.enum(["RESTRICT", "RESTORE"]),
  reason: z.string().trim().max(500).optional(),
});

/**
 * Admin control over a student project (#16). Restricting hides the project
 * from the intranet while keeping the record — nothing is destroyed.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });

  const project = await db.project.findUnique({
    where: { id },
    select: { id: true, userId: true, title: true, visibility: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const restricting = parsed.data.action === "RESTRICT";
  if (restricting && !parsed.data.reason) {
    return NextResponse.json(
      { error: "Give a reason so the student knows why it was restricted." },
      { status: 400 }
    );
  }

  await db.project.update({
    where: { id },
    data: restricting
      ? { visibility: "RESTRICTED", restrictedReason: parsed.data.reason }
      : // Restoring returns it to the student's own control, hidden by default.
        { visibility: "HIDDEN", restrictedReason: null },
  });

  await notify({
    userId: project.userId,
    type: restricting ? "PROJECT_RESTRICTED" : "PROJECT_RESTORED",
    title: restricting
      ? `Your project "${project.title}" was restricted`
      : `Your project "${project.title}" was restored`,
    body: restricting
      ? (parsed.data.reason ?? "Contact the academy if you have questions.")
      : "It's back in your portfolio settings — publish it when you're ready.",
  });

  await auditLog({
    actorId: staff.id,
    action: restricting ? "PROJECT_RESTRICTED" : "PROJECT_RESTORED",
    targetType: "Project",
    targetId: id,
    metadata: { reason: parsed.data.reason, previousVisibility: project.visibility },
  });

  return NextResponse.json({ ok: true });
}