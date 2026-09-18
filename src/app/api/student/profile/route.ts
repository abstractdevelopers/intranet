import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOnboardedStudentApi } from "@/lib/rbac";
import { normaliseUsername, validateUsername, usernameCooldownMs } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { storeUpload, AVATAR_MAX_BYTES, AVATAR_MIME_TYPES } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Update the public profile, username, or avatar after setup (#1, #2). */
export async function POST(request: Request) {
  const guard = await requireOnboardedStudentApi();
  if (!guard.ok) return guard.response;
  const user = guard.user;
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

  // Username changes are rate-limited so a student can't churn their identity.
  const requestedUsername = String(form.get("username") ?? "").trim();
  let newUsername: string | undefined;
  if (requestedUsername) {
    const candidate = normaliseUsername(requestedUsername);
    if (candidate !== user.username) {
      const record = await db.user.findUnique({
        where: { id: user.id },
        select: { usernameChangedAt: true },
      });
      const remaining = usernameCooldownMs(record?.usernameChangedAt ?? null);
      if (remaining > 0) {
        const days = Math.ceil(remaining / 86400000);
        return NextResponse.json(
          { error: `You can change your username again in ${days} day${days === 1 ? "" : "s"}.` },
          { status: 429 }
        );
      }
      const invalid = validateUsername(candidate);
      if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
      const taken = await db.user.findUnique({
        where: { username: candidate },
        select: { id: true },
      });
      if (taken && taken.id !== user.id) {
        return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
      }
      newUsername = candidate;
    }
  }

  // Avatar is optional; a blank field leaves the existing one alone.
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

  await db.$transaction([
    db.profile.upsert({
      where: { userId: user.id },
      update: { fullName, headline, bio, location, phone, ...(avatarDocumentId ? { avatarDocumentId } : {}) },
      create: { userId: user.id, fullName, headline, bio, location, phone, avatarDocumentId },
    }),
    db.user.update({
      where: { id: user.id },
      data: {
        ...(newUsername ? { username: newUsername, usernameChangedAt: new Date() } : {}),
      },
    }),
  ]);

  await auditLog({
    actorId: user.id,
    action: "PROFILE_UPDATED",
    targetType: "User",
    targetId: user.id,
    metadata: { usernameChanged: Boolean(newUsername), avatarChanged: Boolean(avatarDocumentId) },
  });

  return NextResponse.json({ ok: true, username: newUsername ?? user.username });
}
