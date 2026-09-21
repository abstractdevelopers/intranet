import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readDocumentBytes } from "@/lib/storage";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/rbac";

/**
 * Public delivery for email banner images.
 *
 * Email clients fetch images anonymously, so this route cannot require a
 * session — unlike /api/documents/[id], which authorizes per viewer. Access is
 * granted only when the document is an image AND is referenced by a campaign
 * (or, so the composer can preview before saving, when the requester is staff).
 * Knowing a document id alone therefore reveals nothing.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const doc = await db.document.findUnique({
    where: { id },
    select: { storagePath: true, data: true, mimeType: true },
  });
  if (!doc || !doc.mimeType.startsWith("image/")) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const referenced = await db.emailCampaign.findFirst({
    where: { imageIds: { contains: id } },
    select: { id: true },
  });

  if (!referenced) {
    const user = await getSessionUser();
    if (!user || !isStaff(user.role)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
  }

  const bytes = await readDocumentBytes(doc);
  if (!bytes) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}