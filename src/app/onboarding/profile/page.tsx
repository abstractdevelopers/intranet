import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { StepProgress } from "@/components/onboarding/step-progress";
import { ProfileSetupForm } from "@/components/onboarding/profile-setup-form";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/rbac";

export const metadata = { title: "Complete your profile" };

/** Step 3 of account setup: basic profile + optional picture (#1). */
export default async function OnboardingProfilePage() {
  const user = await requireStudent();
  if (user.mustChangePassword) redirect("/onboarding/password");
  if (!user.username) redirect("/onboarding/username");

  const profile = await db.profile.findUnique({ where: { userId: user.id } });

  return (
    <div className="space-y-6">
      <StepProgress steps={["Password", "Username", "Profile", "Pathway"]} current={3} />
      <div>
        <p className="eyebrow">Step 03</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Complete your profile</h1>
        <p className="mt-2 text-sm text-text-muted">
          This is what other creators see when they open your profile. You can change
          any of it later from your profile page.
        </p>
      </div>
      <Card className="p-6">
        <ProfileSetupForm
          initial={{
            fullName: profile?.fullName ?? user.fullName,
            headline: profile?.headline ?? "",
            bio: profile?.bio ?? "",
            location: profile?.location ?? "",
            phone: profile?.phone ?? "",
            hasAvatar: Boolean(profile?.avatarDocumentId),
          }}
        />
      </Card>
    </div>
  );
}

