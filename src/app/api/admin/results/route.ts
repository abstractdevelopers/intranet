import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { computeAllResults } from "@/lib/results";
import { releaseResults, RELEASE_INTERACTIVE_BUDGET_MS } from "@/lib/results-release";
import { DEFAULT_ASSESSMENT_WEIGHTS } from "@/lib/constants";

/**
 * Result collation and release.
 *
 *   RECOMPUTE — recalculate every student's overall score without releasing.
 *   RELEASE   — recompute, then email reports in batches and mark them released.
 *               The UI loops this until `done`, so a large cohort is sent
 *               without waiting for a cron tick.
 *   WEIGHTS   — change the grading weights (they must sum to 100).
 *
 * Releasing is resumable and never double-sends: a result is claimed and
 * stamped before its email goes out.
 */
const schema = z.object({
  action: z.enum(["RECOMPUTE", "RELEASE", "WEIGHTS"]),
  assignmentWeight: z.number().int().min(0).max(100).optional(),
  theoryWeight: z.number().int().min(0).max(100).optional(),
  practicalWeight: z.number().int().min(0).max(100).optional(),
});

export async function GET() {
  await requireStaff();
  const [config, counts] = await Promise.all([
    db.assessmentConfig.findUnique({ where: { id: "global" } }),
    db.studentResult.groupBy({ by: ["released"], _count: { _all: true } }),
  ]);
  const released = counts.find((c) => c.released)?._count._all ?? 0;
  const total = counts.reduce((n, c) => n + c._count._all, 0);
  return NextResponse.json({
    weights: config ?? { ...DEFAULT_ASSESSMENT_WEIGHTS, id: "global" },
    total,
    released,
  });
}

export async function POST(request: Request) {
  const staff = await requireStaff();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  if (parsed.data.action === "WEIGHTS") {
    const a = parsed.data.assignmentWeight;
    const t = parsed.data.theoryWeight;
    const p = parsed.data.practicalWeight;
    if (a === undefined || t === undefined || p === undefined) {
      return NextResponse.json({ error: "All three weights are required." }, { status: 400 });
    }
    if (a + t + p !== 100) {
      return NextResponse.json({ error: "The weights must add up to 100." }, { status: 400 });
    }
    await db.assessmentConfig.upsert({
      where: { id: "global" },
      create: { id: "global", assignmentWeight: a, theoryWeight: t, practicalWeight: p, updatedById: staff.id },
      update: { assignmentWeight: a, theoryWeight: t, practicalWeight: p, updatedById: staff.id },
    });
    await auditLog({
      actorId: staff.id,
      action: "ASSESSMENT_WEIGHTS_UPDATED",
      targetType: "AssessmentConfig",
      targetId: "global",
      metadata: { assignment: a, theory: t, practical: p },
    });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "RECOMPUTE") {
    const count = await computeAllResults();
    await auditLog({
      actorId: staff.id,
      action: "RESULTS_RECOMPUTED",
      targetType: "StudentResult",
      metadata: { count },
    });
    return NextResponse.json({ ok: true, count });
  }

  // RELEASE
  const progress = await releaseResults({ timeBudgetMs: RELEASE_INTERACTIVE_BUDGET_MS });
  await auditLog({
    actorId: staff.id,
    action: "RESULTS_RELEASED",
    targetType: "StudentResult",
    metadata: { sent: progress.sent, failed: progress.failed, remaining: progress.remaining },
  });
  return NextResponse.json({ ok: true, progress });
}
