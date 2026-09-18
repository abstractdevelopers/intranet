import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/rbac";

/** Routes a student to whichever account-setup step is still outstanding (#1). */
export default async function OnboardingIndexPage() {
  const user = await requireStudent();
  if (user.mustChangePassword) redirect("/onboarding/password");
  if (!user.username) redirect("/onboarding/username");
  if (!user.onboardingCompletedAt) redirect("/onboarding/profile");
  redirect("/student");
}
