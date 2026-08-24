import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { EnrollmentError, submitApplication } from "@/lib/enrollment";
import { OCCUPATIONS, EXPERIENCE_LEVELS } from "@/lib/constants";

const schema = z.object({
  currentOccupation: z.enum(OCCUPATIONS.map((o) => o.value) as [string, ...string[]]),
  experienceLevel: z.enum(EXPERIENCE_LEVELS.map((l) => l.value) as [string, ...string[]]),
  about: z.string().trim().min(10, "Please tell us a bit more about yourself.").max(5000),
  motivation: z.string().trim().min(10, "Please share your motivation.").max(5000),
  goals: z.string().trim().min(10, "Please share your goals.").max(5000),
  challenge: z.string().trim().min(5, "Please share your current challenge.").max(5000),
  selectedElectiveId: z.string().min(1, "Please select one elective."),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    await submitApplication({ userId: user.id, ...parsed.data });
    return NextResponse.json({ ok: true, redirect: "/student" });
  } catch (error) {
    if (error instanceof EnrollmentError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[uca] application submission failed", error);
    return NextResponse.json(
      { error: "We couldn't complete that action. Please try again." },
      { status: 500 }
    );
  }
}
