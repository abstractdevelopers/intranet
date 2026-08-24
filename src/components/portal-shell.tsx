import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export type NavItem = { href: string; label: string };

export function PortalShell({
  brand,
  nav,
  userName,
  userRole,
  children,
}: {
  brand: string;
  nav: NavItem[];
  userName: string;
  userRole: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="border-b border-border px-6 py-5">
          <Link href="/" className="text-lg font-bold tracking-tight">
            <span className="text-brand-1 dark:text-brand-3">UCA</span> Sandbox
          </Link>
          <p className="mt-0.5 text-xs text-text-muted">{brand}</p>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="Portal">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-brand-1"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-3 border-t border-border px-4 py-4">
          <ThemeToggle />
          <div className="text-sm">
            <p className="font-medium">{userName}</p>
            <p className="text-xs text-text-muted">{userRole}</p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="text-sm font-medium text-brand-1 hover:text-brand-2 dark:text-brand-3"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
          <Link href="/" className="text-base font-bold">
            <span className="text-brand-1 dark:text-brand-3">UCA</span> Sandbox
          </Link>
          <ThemeToggle />
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-3 py-2 md:hidden" aria-label="Portal mobile">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-text-muted hover:bg-surface-2 hover:text-text"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
