import Link from "next/link";
import { BrandLockup } from "@/components/crest";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireUser } from "@/lib/rbac";

export const metadata = { title: "Account setup" };

/**
 * Account setup (#1). A student lands here straight after their first login
 * with a temporary password, and again until onboarding is finished. It is
 * deliberately not the student portal — no navigation, one job at a time.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div className="min-h-screen bg-surface-2">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Link href="/" aria-label="UCA Sandbox home">
            <BrandLockup subtitle="Account setup" />
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10">{children}</main>
    </div>
  );
}
