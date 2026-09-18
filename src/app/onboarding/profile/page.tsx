import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
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
      <StepProgress current={3} />
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

function StepProgress({ current }: { current: number }) {
  const steps = ["Password", "Username", "Profile"];
  return (
    <ol className="flex items-center gap-2 text-xs font-semibold">
      {steps.map((label, i) => {
        const n = i + 1;
        const state = n === current ? "current" : n < current ? "done" : "todo";
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                state === "current"
                  ? "bg-brand-1 text-white"
                  : state === "done"
                    ? "bg-brand-1/20 text-brand-1 dark:text-brand-3"
                    : "border border-border text-text-muted"
              }`}
            >
              {n}
            </span>
            <span className={state === "todo" ? "text-text-muted" : ""}>{label}</span>
            {n < steps.length ? <span className="text-text-muted">·</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
