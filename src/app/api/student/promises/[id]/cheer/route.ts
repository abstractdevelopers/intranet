import { NextResponse } from "next/server";
import { requireOnboardedStudentApi } from "@/lib/rbac";
import { toggleCheer } from "@/lib/promises";

export const dynamic = "force-dynamic";

/** Cheer or un-cheer a promise. One cheer per student per promise. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const result = await toggleCheer(id, guard.user.id);
  if (!result) return NextResponse.json({ error: "That promise isn't available." }, { status: 404 });

  return NextResponse.json({ ok: true, ...result });
}
