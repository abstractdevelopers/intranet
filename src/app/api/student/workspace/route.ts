import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOnboardedStudentApi } from "@/lib/rbac";
import { getWorkspaceProvider } from "@/lib/workspace";

/** Provision (or return) the student's workspace through the configured provider. */
export async function POST() {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const user = guard.user;

  const existing = await db.workspace.findFirst({
    where: { ownerId: user.id, status: { not: "SUSPENDED" } },
  });
  if (existing) return NextResponse.json({ ok: true, id: existing.id, status: existing.status });

  const provider = getWorkspaceProvider();
  const result = await provider.provision({ userId: user.id, email: user.email });

  const name = user.email.split("@")[0];
  const workspace = await db.workspace.create({
    data: {
      name: `${name}'s workspace`,
      ownerId: user.id,
      provider: result.provider,
      externalId: result.externalId,
      url: result.url,
      status: result.status,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  return NextResponse.json({ ok: true, id: workspace.id, status: workspace.status });
}
