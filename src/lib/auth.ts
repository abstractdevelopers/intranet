import { cache } from "react";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "./db";
import type { Role } from "./constants";

export const SESSION_COOKIE = "uca_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export type SessionUser = {
  id: string;
  email: string;
  role: Role;
  status: string;
  fullName: string;
  username: string | null;
  mustChangePassword: boolean;
  onboardingCompletedAt: Date | null;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { token, userId, expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { token } });
  }
  jar.delete(SESSION_COOKIE);
}

/**
 * Session lookup is deduplicated per request: layouts, pages and route
 * handlers in the same render share a single database round-trip.
 */
export const getSessionUser = cache(async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: { include: { profile: true } } },
  });
  if (!session || session.expiresAt < new Date()) {
    if (session) await db.session.delete({ where: { id: session.id } });
    return null;
  }
  if (session.user.status !== "ACTIVE") return null;

  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role as Role,
    status: session.user.status,
    fullName: session.user.profile?.fullName ?? session.user.email,
    username: session.user.username,
    mustChangePassword: session.user.mustChangePassword,
    onboardingCompletedAt: session.user.onboardingCompletedAt,
  };
});

/** Invalidate every session for a user (e.g. after a role change). */
export async function revokeSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

/** Username rules (#1): lowercase, 3–30 chars, letters/numbers/underscore/dot. */
export const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

/** Usernames that must not be claimable — they'd be confusing or impersonating. */
const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "uca", "ucasandbox", "support", "help", "staff",
  "founder", "moderator", "official", "root", "system", "me", "you", "profile",
  "settings", "api", "login", "signup", "student", "creators", "projects",
]);

export function normaliseUsername(raw: string) {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): string | null {
  const username = normaliseUsername(raw);
  if (!username) return "Choose a username.";
  if (!USERNAME_PATTERN.test(username)) {
    return "Usernames are 3–30 characters: lowercase letters, numbers, dots and underscores.";
  }
  if (RESERVED_USERNAMES.has(username)) return "That username isn't available.";
  return null;
}

/** How long a student must wait before changing their username again. */
export const USERNAME_CHANGE_COOLDOWN_DAYS = 14;

/** Milliseconds remaining before a username may change again, if any. */
export function usernameCooldownMs(changedAt: Date | null, now: Date = new Date()) {
  if (!changedAt) return 0;
  const readyAt = new Date(changedAt);
  readyAt.setDate(readyAt.getDate() + USERNAME_CHANGE_COOLDOWN_DAYS);
  return Math.max(0, readyAt.getTime() - now.getTime());
}

export async function createEmailToken(userId: string, type: "VERIFY_EMAIL" | "PASSWORD_RESET") {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
  await db.emailToken.create({ data: { userId, token, type, expiresAt } });
  return token;
}

export async function consumeEmailToken(token: string, type: "VERIFY_EMAIL" | "PASSWORD_RESET") {
  const record = await db.emailToken.findUnique({ where: { token } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) {
    return null;
  }
  await db.emailToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return record;
}
