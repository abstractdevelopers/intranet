import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { StepProgress } from "@/components/onboarding/step-progress";
import { PasswordSetupForm } from "@/components/onboarding/password-setup-form";
import { ReclaimPerks } from "@/components/onboarding/reclaim-perks";
import { requireStudent } from "@/lib/rbac";
import { elitePlacesRemaining } from "@/lib/elite";

export const metadata = { title: "Set your password" };

/** Step 1 of account setup: replace the temporary password (#1). */
export default async function OnboardingPasswordPage() {
  const user = await requireStudent();
  if (!user.mustChangePassword) redirect("/onboarding");
  const eliteRemaining = await elitePlacesRemaining();

  return (
    <div className="space-y-6">
      <StepProgress steps={["Password", "Username", "Profile", "Pathway"]} current={1} />
      <div>
        <p className="eyebrow">Step 01</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Set your password</h1>
        <p className="mt-2 text-sm text-text-muted">
          Welcome to UCA Sandbox. Replace the temporary password the academy gave you with
          one only you know.
        </p>
      </div>
      <Card className="p-6">
        <PasswordSetupForm />
      </Card>
      <ReclaimPerks eliteRemaining={eliteRemaining} />
    </div>
  );
}

