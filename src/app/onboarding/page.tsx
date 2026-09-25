import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/rbac";
import { hasProgramme } from "@/lib/enrollment";
import { isPathwayAutoApprovalActive } from "@/lib/constants";

/** Routes a student to whichever account-setup step is still outstanding (#1). */
export default async function OnboardingIndexPage() {
  const user = await requireStudent();
  if (user.mustChangePassword) redirect("/onboarding/password");
  if (!user.username) redirect("/onboarding/username");
  if (!user.onboardingCompletedAt) redirect("/onboarding/profile");
  // Returning creators still need a pathway; the one-click picker is only
  // offered while the time-boxed auto-approval allowance is open.
  if (!(await hasProgramme(user.id))) {
    redirect(isPathwayAutoApprovalActive() ? "/onboarding/pathway" : "/student/apply");
  }
  redirect("/student");
}
