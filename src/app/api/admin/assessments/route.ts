import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { ASSESSMENT_OPENS_AT, ASSESSMENT_CLOSES_AT } from "@/lib/constants";

/**
 * Create an assessment paper. `pathway` null makes it apply to every pathway;
 * otherwise it is the paper for that pathway only. The window defaults to the
 * academy's shared dates so a new paper is open in one step.
 */
const schema = z.object({
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens."),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  kind: z.enum(["THEORY", "PRACTICAL"]),
  pathway: z.enum(["GRAPHIC_DESIGN", "VIDEO_EDITING", "COMMUNICATION_INFLUENCE", "CONTENT_WRITING"]).nullable().optional(),
  instructions: z.string().trim().max(20_000).nullable().optional(),
  openAt: z.string().datetime().nullable().optional(),
  closeAt: z.string().datetime().nullable().optional(),
  maxScore: z.number().int().min(1).max(1000).optional(),
  passMark: z.number().int().min(0).max(100).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

export async function GET() {
  await requireStaff();
  const assessments = await db.assessment.findMany({
    orderBy: [{ kind: "asc" }, { pathway: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { questions: true, submissions: true } } },
  });
  return NextResponse.json({
    assessments: assessments.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      kind: a.kind,
      pathway: a.pathway,
      status: a.status,
      openAt: a.openAt,
      closeAt: a.closeAt,
      questionCount: a._count.questions,
      submissionCount: a._count.submissions,
    })),
  });
}

export async function POST(request: Request) {
  const staff = await requireStaff();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the assessment details." }, { status: 400 });
  }

  const clash = await db.assessment.findUnique({ where: { slug: parsed.data.slug } });
  if (clash) return NextResponse.json({ error: "That slug is already in use." }, { status: 400 });

  const assessment = await db.assessment.create({
    data: {
      slug: parsed.data.slug,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      kind: parsed.data.kind,
      pathway: parsed.data.pathway ?? null,
      instructions: parsed.data.instructions ?? null,
      openAt: parsed.data.openAt ? new Date(parsed.data.openAt) : ASSESSMENT_OPENS_AT,
      closeAt: parsed.data.closeAt ? new Date(parsed.data.closeAt) : ASSESSMENT_CLOSES_AT,
      maxScore: parsed.data.maxScore ?? 100,
      passMark: parsed.data.passMark ?? 50,
      status: parsed.data.status ?? "DRAFT",
    },
  });

  await auditLog({
    actorId: staff.id,
    action: "ASSESSMENT_CREATED",
    targetType: "Assessment",
    targetId: assessment.id,
    metadata: { kind: assessment.kind, pathway: assessment.pathway },
  });
  return NextResponse.json({ ok: true, id: assessment.id });
}
