import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOnboardedStudentApi } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";

const schema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  summary: z.string().trim().max(600).optional(),
  description: z.string().trim().max(4000).optional(),
  externalUrl: z.string().trim().url().max(500).nullable().optional(),
  repoUrl: z.string().trim().url().max(500).nullable().optional(),
  visibility: z.enum(["PUBLISHED", "HIDDEN"]).optional(),
  featured: z.boolean().optional(),
});

/** Edit, curate or remove a portfolio piece (#4). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const user = guard.user;
  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: user.id },
    select: { id: true, visibility: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  // An admin restriction outranks the student's own control.
  if (project.visibility === "RESTRICTED") {
    return NextResponse.json(
      { error: "This project was restricted by the academy and can't be edited." },
      { status: 403 }
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await db.project.update({
    where: { id },
    data: {
      ...parsed.data,
      externalUrl: parsed.data.externalUrl === undefined ? undefined : parsed.data.externalUrl,
      repoUrl: parsed.data.repoUrl === undefined ? undefined : parsed.data.repoUrl,
    },
  });

  await auditLog({
    actorId: user.id,
    action: "PROJECT_UPDATED",
    targetType: "Project",
    targetId: id,
    metadata: parsed.data,
  });

  return NextResponse.json({ ok: true });
}

/** Remove a project from the creator's portfolio (#4). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const user = guard.user;
  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: user.id },
    select: { id: true, title: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  await db.project.delete({ where: { id } });
  await auditLog({
    actorId: user.id,
    action: "PROJECT_DELETED",
    targetType: "Project",
    targetId: id,
    metadata: { title: project.title },
  });

  return NextResponse.json({ ok: true });
}
