import { NextResponse } from "next/server";
import { requireOnboardedStudentApi } from "@/lib/rbac";
import { getAssessmentView, submitPractical } from "@/lib/assessments";
import { storeUpload } from "@/lib/storage";

/**
 * Practical assessment submission.
 *
 * Accepts a written response, a hosted link, and/or an uploaded file — the
 * deliverable may be any of these. Files go through the shared storage helper
 * (bytes in the database), so an uploaded deliverable survives serverless
 * deploys exactly as assignment uploads do.
 */

const ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
];

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const view = await getAssessmentView(id, guard.user.id);
  if (!view || view.kind !== "PRACTICAL") {
    return NextResponse.json({ error: "Assessment not available." }, { status: 404 });
  }
  return NextResponse.json(view);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid submission." }, { status: 400 });

  const textContent = String(form.get("textContent") ?? "").trim() || null;
  const externalUrl = String(form.get("url") ?? "").trim() || null;
  const file = form.get("file");

  const files: { documentId: string; fileName: string }[] = [];
  if (file instanceof File && file.size > 0) {
    const stored = await storeUpload(file, guard.user.id, {
      allowedMimeTypes: ALLOWED_MIME,
    });
    if (!stored.ok) return NextResponse.json({ error: stored.error }, { status: 400 });
    files.push(stored.stored);
  }

  const result = await submitPractical(guard.user.id, id, { textContent, externalUrl, files });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
