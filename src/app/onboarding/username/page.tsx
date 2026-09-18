import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
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
      <StepProgress current={2} />
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
