import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/rbac";
import { storeUpload, MAX_UPLOAD_BYTES } from "@/lib/storage";

/**
 * Upload a banner image for an email campaign.
 *
 * Bytes are stored in the database (see storage.ts — serverless filesystems are
 * read-only), then served publicly through /api/public/email-assets/[id], which
 * email clients can fetch without a session.
 */
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function POST(request: Request) {
  const staff = await requireStaff();

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  }

  const stored = await storeUpload(file, staff.id, {
    maxBytes: MAX_UPLOAD_BYTES,
    allowedMimeTypes: ALLOWED,
  });
  if (!stored.ok) return NextResponse.json({ error: stored.error }, { status: 400 });

  return NextResponse.json({
    ok: true,
    id: stored.stored.documentId,
    url: `/api/public/email-assets/${stored.stored.documentId}`,
    fileName: stored.stored.fileName,
  });
}