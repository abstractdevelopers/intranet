import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <Link href="/" className="text-lg font-bold tracking-tight">
          <span className="text-brand-1 dark:text-brand-3">UCA</span> Sandbox
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-text-muted">{subtitle}</p> : null}
          <div className="mt-6 rounded-xl border border-border bg-surface p-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
