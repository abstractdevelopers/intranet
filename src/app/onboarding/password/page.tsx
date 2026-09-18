import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PasswordSetupForm } from "@/components/onboarding/password-setup-form";
import { requireStudent } from "@/lib/rbac";

export const metadata = { title: "Set your password" };

/** Step 1 of account setup: replace the temporary password (#1). */
export default async function OnboardingPasswordPage() {
  const user = await requireStudent();
  if (!user.mustChangePassword) redirect("/onboarding");

  return (
    <div className="space-y-6">
      <StepProgress current={1} />
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
