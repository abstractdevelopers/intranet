import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/rbac";

/** UCA Sandbox is an intranet — there is no public landing page. */
export default async function Root() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(isStaff(user.role) ? "/admin" : "/student");
}
