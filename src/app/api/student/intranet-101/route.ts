import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOnboardedStudentApi } from "@/lib/rbac";
import { getIntranet101, submitIntranet101 } from "@/lib/quiz";

/**
 * Intranet 101 attempts.
 *
 * GET returns the questions with correct answers stripped. POST grades on the
 * server and enforces the attempt limit here — the client is never trusted with
 * either the answers or the remaining-attempt count.
 */
export async function GET() {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;

  const quiz = await getIntranet101(guard.user.id);
  if (!quiz) return NextResponse.json({ error: "Assessment not available." }, { status: 404 });
  return NextResponse.json(quiz);
}

const schema = z.object({
  answers: z.record(z.string(), z.string()),
});

export async function POST(request: Request) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid submission." }, { status: 400 });

  const result = await submitIntranet101(guard.user.id, parsed.data.answers);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
