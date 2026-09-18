import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "./auth";
import { APPLICATION_REVIEWER_ROLES, STAFF_ROLES, type Role } from "./constants";

export function isStaff(role: Role) {
  return STAFF_ROLES.includes(role);
}

export function canReviewApplications(role: Role) {
  return APPLICATION_REVIEWER_ROLES.includes(role);
}

/** Require any authenticated user; redirects to /login otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Require a student-side account. */
export async function requireStudent(): Promise<SessionUser> {
  const user = await requireUser();
  if (isStaff(user.role)) redirect("/admin");
  return user;
}

/**
 * Require a student whose account setup is complete (#1). Sends anybody who
 * still has a temporary password, or who hasn't finished onboarding, to the
 * setup flow rather than letting them into the portal.
 */
export async function requireOnboardedStudent(): Promise<SessionUser> {
  const user = await requireStudent();
  if (user.mustChangePassword) redirect("/onboarding/password");
  if (!user.onboardingCompletedAt) redirect("/onboarding");
  return user;
}

/**
 * The API-route equivalent of `requireOnboardedStudent`. Route handlers can't
 * `redirect()`, so setup gating for JSON endpoints returns the response to
 * send instead. Without this, a temporary-password session could call student
 * APIs directly while the page-level guard was skipped.
 */
export type StudentApiGuard =
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse };

export async function requireOnboardedStudentApi(): Promise<StudentApiGuard> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }
  if (isStaff(user.role)) {
    return { ok: false, response: NextResponse.json({ error: "Staff accounts can't do that." }, { status: 403 }) };
  }
  if (user.mustChangePassword) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Set a new password before continuing.", redirect: "/onboarding/password" },
        { status: 403 }
      ),
    };
  }
  if (!user.onboardingCompletedAt) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Finish setting up your account first.", redirect: "/onboarding" },
        { status: 403 }
      ),
    };
  }
  return { ok: true, user };
}

/** Require staff (admin portal) access. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isStaff(user.role)) redirect("/student");
  return user;
}

/** Require application-review privileges. */
export async function requireApplicationReviewer(): Promise<SessionUser> {
  const user = await requireStaff();
  if (!canReviewApplications(user.role)) redirect("/admin");
  return user;
}

/** Roles allowed to manage other users' roles. */
export function canManageRoles(role: Role) {
  return role === "FOUNDER" || role === "SUPER_ADMIN";
}

/** Require role-management privileges. */
export async function requireRoleManager(): Promise<SessionUser> {
  const user = await requireStaff();
  if (!canManageRoles(user.role)) redirect("/admin");
  return user;
}
