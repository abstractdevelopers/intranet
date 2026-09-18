import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOnboardedStudentApi } from "@/lib/rbac";
import { notify } from "@/lib/audit";
import { canViewCreator } from "@/lib/projects";

export const dynamic = "force-dynamic";

/** Like / unlike a project (#3). */
export async function POST(request: Request) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const user = guard.user;
  const body = await request.json().catch(() => null);
  const projectId = String((body as { projectId?: unknown } | null)?.projectId ?? "");
  if (!projectId) return NextResponse.json({ error: "Choose a project." }, { status: 400 });

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, userId: true, visibility: true, title: true },
  });
  // A restricted project is invisible to everyone but its owner.
  if (!project || project.visibility !== "PUBLISHED") {
    return NextResponse.json({ error: "That project isn't available." }, { status: 404 });
  }
  if (!(await canViewCreator(user.id, project.userId))) {
    return NextResponse.json({ error: "That project isn't available." }, { status: 404 });
  }

  const existing = await db.projectLike.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });

  if (existing) {
    await db.projectLike.delete({ where: { id: existing.id } });
    const count = await db.projectLike.count({ where: { projectId } });
    return NextResponse.json({ ok: true, liked: false, count });
  }

  await db.projectLike.create({ data: { projectId, userId: user.id } });
  if (project.userId !== user.id) {
    await notify({
      userId: project.userId,
      type: "PROJECT_LIKED",
      title: `${user.fullName} liked "${project.title}"`,
      body: "Your work is getting attention in the intranet.",
    });
  }
  const count = await db.projectLike.count({ where: { projectId } });
  return NextResponse.json({ ok: true, liked: true, count });
}
