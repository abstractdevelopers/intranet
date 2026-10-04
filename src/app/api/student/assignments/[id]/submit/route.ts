import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOnboardedStudentApi } from "@/lib/rbac";
import { notify } from "@/lib/audit";
import { storageKeyFor, writeToDiskIfPossible, effectiveMaxBytes } from "@/lib/storage";
import { isAssignmentReleased } from "@/lib/module-access";
import { isBlockedForLateness, isLate } from "@/lib/late-policy";
import { publishProjectFromSubmission } from "@/lib/projects";

const MIME_BY_TYPE: Record<string, string[]> = {
  PDF: ["application/pdf"],
  DOC: ["application/msword"],
  DOCX: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ZIP: ["application/zip", "application/x-zip-compressed"],
  IMAGE: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  // Small video clips only. A 30-60s 1080p export is far larger than the
  // platform body ceiling, so full-size submissions come as a hosted link
  // (URL/VIDEO) rather than an upload — see MAX_UPLOAD_BYTES in lib/storage.
  VIDEO: ["video/mp4", "video/quicktime", "video/webm"],
};

function allowedTypes(assignment: { allowedTypes: string }): string[] {
  try {
    const parsed = JSON.parse(assignment.allowedTypes);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    /* fall through */
  }
  return assignment.allowedTypes.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const user = guard.user;
  const { id } = await params;

  const assignment = await db.assignment.findFirst({
    where: { id, module: { status: "PUBLISHED" } },
    include: { module: { select: { courseId: true, releaseAt: true, title: true } } },
  });
  if (!assignment) return NextResponse.json({ error: "Assignment not found." }, { status: 404 });

  // Enrolled + accepted, and the module must be released.
  const enrollment = await db.enrollment.findFirst({
    where: { userId: user.id, courseId: assignment.module.courseId, status: "ACCEPTED" },
    select: { id: true },
  });
  if (!enrollment) return NextResponse.json({ error: "Not enrolled in this course." }, { status: 403 });

  // An assignment can open later than its week (Monday's week, Wednesday's
  // assignment), so check its own releaseAt as well as the module's.
  if (
    !isAssignmentReleased({
      assignmentReleaseAt: assignment.releaseAt,
      moduleReleaseAt: assignment.module.releaseAt,
      preview: user.previewUnreleasedContent,
    })
  ) {
    return NextResponse.json({ error: "This assignment isn't available yet." }, { status: 403 });
  }

  // Late policy. BLOCK refuses the submission outright; ALLOW and PENALTY
  // accept it, and lateness is recorded so PENALTY can deduct at grading time.
  const now = new Date();
  const late = isLate(now, assignment.deadline);
  if (isBlockedForLateness(assignment.deadline, assignment.latePolicy, now)) {
    return NextResponse.json(
      {
        error: assignment.deadline
          ? `The deadline passed on ${assignment.deadline.toISOString().slice(0, 10)} and late submissions aren't accepted.`
          : "Late submissions aren't accepted.",
      },
      { status: 400 }
    );
  }

  // Attempt limit (submissions are never overwritten — history is preserved)
  const attempts = await db.assignmentSubmission.count({
    where: { assignmentId: id, userId: user.id },
  });
  if (attempts >= assignment.maxAttempts) {
    return NextResponse.json(
      { error: `You've used all ${assignment.maxAttempts} attempts.` },
      { status: 400 }
    );
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid submission." }, { status: 400 });

  const allowed = allowedTypes(assignment);
  const textContent = String(form.get("textContent") ?? "").trim() || null;
  const url = String(form.get("url") ?? "").trim() || null;
  const file = form.get("file");

  const isFile = file instanceof File && file.size > 0;
  if (!isFile && !textContent && !url) {
    return NextResponse.json({ error: "Add a file, text, or a URL to submit." }, { status: 400 });
  }

  // Validate the submission kind against the assignment's allowed types.
  if (textContent && !allowed.includes("TEXT")) {
    return NextResponse.json({ error: "Text submissions aren't allowed here." }, { status: 400 });
  }
  if (url) {
    const urlAllowed =
      (allowed.includes("GITHUB") && /github\.com/i.test(url)) ||
      (allowed.includes("GITLAB") && /gitlab\.com/i.test(url)) ||
      allowed.includes("URL") ||
      allowed.includes("VIDEO") ||
      allowed.includes("REPO");
    if (!urlAllowed) {
      return NextResponse.json({ error: "That link type isn't allowed here." }, { status: 400 });
    }
  }

  // Persist the file (if any) with type and size validation.
  let documentId: string | null = null;
  let fileName: string | null = null;
  if (isFile && file instanceof File) {
    const maxBytes = effectiveMaxBytes(assignment.maxFileSizeMb);
    if (file.size > maxBytes) {
      return NextResponse.json(
        {
          error: `Files must be ${Math.round(maxBytes / 1024 / 1024)}MB or smaller. Try compressing the document or exporting it at a lower quality.`,
        },
        { status: 413 }
      );
    }
    const mimeOk = allowed.some((t) => MIME_BY_TYPE[t]?.includes(file.type));
    if (!mimeOk) {
      return NextResponse.json({ error: "That file type isn't allowed here." }, { status: 400 });
    }
    const storagePath = storageKeyFor(file.name);
    const fileBytes = Buffer.from(await file.arrayBuffer());
    const doc = await db.document.create({
      data: {
        title: file.name,
        storagePath,
        data: fileBytes,
        mimeType: file.type,
        sizeBytes: file.size,
        uploadedById: user.id,
      },
    });
    await writeToDiskIfPossible(storagePath, fileBytes);
    documentId = doc.id;
    fileName = file.name;
  }

  const status =
    attempts > 0 ? "RESUBMITTED" : "SUBMITTED";
  const submission = await db.assignmentSubmission.create({
    data: {
      assignmentId: id,
      userId: user.id,
      attempt: attempts + 1,
      status,
      late,
      textContent,
      repoUrl: url && /github|gitlab/i.test(url) ? url : null,
      externalUrl: url && !/github|gitlab/i.test(url) ? url : null,
      files: documentId && fileName ? { create: { documentId, fileName } } : undefined,
    },
  });

  // Every submission becomes a portfolio piece straight away, as a private
  // draft. A student's work is then never invisible while marking is pending,
  // and a passing grade later publishes it automatically.
  await publishProjectFromSubmission(submission.id, user.id);

  // Notify reviewers/admins that work awaits review.
  const staff = await db.user.findMany({
    where: { role: { in: ["FOUNDER", "SUPER_ADMIN", "ACADEMY_ADMIN", "INSTRUCTOR", "REVIEWER"] } },
    select: { id: true },
  });
  await Promise.all(
    staff.map((s) =>
      notify({
        userId: s.id,
        type: "SUBMISSION_RECEIVED",
        title: "New submission awaiting review",
        body: `${user.fullName} submitted "${assignment.title}".`,
      })
    )
  );

  return NextResponse.json({ ok: true, submissionId: submission.id });
}
