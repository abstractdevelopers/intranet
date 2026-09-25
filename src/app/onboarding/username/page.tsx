import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { StepProgress } from "@/components/onboarding/step-progress";
import { UsernameForm } from "@/components/onboarding/username-form";
import { requireStudent } from "@/lib/rbac";

export const metadata = { title: "Choose your username" };

/** Step 2 of account setup: claim the public identity (#1). */
export default async function OnboardingUsernamePage() {
  const user = await requireStudent();
  if (user.mustChangePassword) redirect("/onboarding/password");
  if (!user.onboardingCompletedAt && user.username) redirect("/onboarding/profile");

  return (
    <div className="space-y-6">
      <StepProgress steps={["Password", "Username", "Profile", "Pathway"]} current={2} />
      <div>
        <p className="eyebrow">Step 02</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Choose your username</h1>
        <p className="mt-2 text-sm text-text-muted">
          This becomes your public identity inside the intranet — it is how other creators
          find you and how your profile is addressed.
        </p>
      </div>
      <Card className="p-6">
        <UsernameForm initial={user.username ?? ""} />
      </Card>
    </div>
  );
}

