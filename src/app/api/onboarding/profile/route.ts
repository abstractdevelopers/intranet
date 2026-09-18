import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { storeUpload, AVATAR_MAX_BYTES, AVATAR_MIME_TYPES } from "@/lib/storage";

/** Finish onboarding: basic profile details + optional avatar (#1). */
export async function POST(request: Request) {
  const user = await requireStudent();
  if (user.mustChangePassword) {
    return NextResponse.json({ error: "Set your password first." }, { status: 409 });
  }
  if (!user.username) {
    return NextResponse.json({ error: "Choose a username first." }, { status: 409 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid profile details." }, { status: 400 });

  const fullName = String(form.get("fullName") ?? "").trim();
  if (fullName.length < 2) {
    return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
  }
  if (fullName.length > 120) {
    return NextResponse.json({ error: "That name is too long." }, { status: 400 });
  }

  const headline = String(form.get("headline") ?? "").trim().slice(0, 140) || null;
  const bio = String(form.get("bio") ?? "").trim().slice(0, 1000) || null;
  const location = String(form.get("location") ?? "").trim().slice(0, 120) || null;
  const phone = String(form.get("phone") ?? "").trim().slice(0, 40) || null;

  let avatarDocumentId: string | undefined;
  const avatar = form.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    const stored = await storeUpload(avatar, user.id, {
      maxBytes: AVATAR_MAX_BYTES,
      allowedMimeTypes: AVATAR_MIME_TYPES,
    });
    if (!stored.ok) return NextResponse.json({ error: stored.error }, { status: 400 });
    avatarDocumentId = stored.stored.documentId;
  }

  const now = new Date();
  await db.$transaction([
    db.profile.upsert({
      where: { userId: user.id },
      update: { fullName, headline, bio, location, phone, ...(avatarDocumentId ? { avatarDocumentId } : {}) },
      create: { userId: user.id, fullName, headline, bio, location, phone, avatarDocumentId },
    }),
    db.user.update({ where: { id: user.id }, data: { onboardingCompletedAt: now } }),
  ]);

  await auditLog({
    actorId: user.id,
    action: "ONBOARDING_COMPLETED",
    targetType: "User",
    targetId: user.id,
    metadata: { hasAvatar: Boolean(avatarDocumentId) },
  });

  return NextResponse.json({ ok: true, redirect: "/student" });
}
