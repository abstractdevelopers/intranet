import { redirect } from "next/navigation";
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
