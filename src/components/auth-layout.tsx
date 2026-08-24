import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "./theme-toggle";
import { Crest } from "./crest";

/**
 * Centered auth layout: official UCA mark above a clean card.
 * Works equally on mobile and desktop — no wasted split panel.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center bg-surface-2 px-4 py-10 dark:bg-ink">
      {/* soft brand wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-1/10 to-transparent dark:from-brand-1/25"
      />
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative flex w-full max-w-md flex-1 flex-col justify-center">
        <Link href="/login" className="mx-auto mb-8 block" aria-label="UCA Sandbox">
          <Crest className="h-12 w-auto" invert />
        </Link>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(13,7,11,0.04),0_8px_24px_rgba(13,7,11,0.06)] sm:p-8 dark:bg-surface">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>

        <p className="mt-6 text-center text-xs text-text-muted">
          UCA Sandbox · A modern academy for the ambitious
        </p>
      </div>
    </div>
  );
}
