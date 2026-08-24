import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { Crest, CrestBackground } from "./crest";
import { IconMilestone, IconWorkspace, IconTrophy } from "./icons";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel — the academy's front door */}
      <div className="hero-band hidden w-[42%] flex-col justify-between p-10 lg:flex">
        <Link href="/" className="flex items-center gap-2.5" aria-label="UCA Sandbox home">
          <Crest className="h-8 w-auto text-white" />
          <span className="text-lg font-bold tracking-tight text-white">UCA Sandbox</span>
        </Link>
        <div className="relative">
          <CrestBackground className="pointer-events-none absolute -top-24 right-0 h-64 w-64 text-white/5" />
          <p className="hero-eyebrow text-[11px] font-semibold uppercase tracking-[0.2em]">
            A modern academy for the ambitious
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-white">
            Learn. Build.
            <br />
            Become undeniable.
          </h2>
          <ul className="mt-8 space-y-4 text-sm text-white/80">
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <IconMilestone className="h-4 w-4 text-brand-3" />
              </span>
              Structured weekly training in branding, media and creative craft
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <IconWorkspace className="h-4 w-4 text-brand-3" />
              </span>
              A sandbox workspace to build real work as you learn
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <IconTrophy className="h-4 w-4 text-brand-3" />
              </span>
              Feedback, milestones and a path to graduation
            </li>
          </ul>
        </div>
        <p className="text-xs text-white/50">
          First month free · ₦15,000 per course monthly after
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between px-6 py-4 lg:justify-end">
          <Link href="/" className="flex items-center gap-2 text-ink lg:hidden dark:text-white" aria-label="UCA Sandbox home">
            <Crest className="h-7 w-auto" />
            <span className="font-bold tracking-tight">UCA Sandbox</span>
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-16">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
