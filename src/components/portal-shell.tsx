import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { ThemeToggle } from "./theme-toggle";
import { BrandLockup } from "./crest";
import { IconLogout } from "./icons";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export type NavSection = { label: string; items: NavItem[] };

export function PortalShell({
  portal,
  sections,
  userName,
  userRole,
  children,
}: {
  portal: string;
  sections: NavSection[];
  userName: string;
  userRole: string;
  children: React.ReactNode;
}) {
  const allItems = sections.flatMap((s) => s.items);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="border-b border-border px-5 py-5">
          <Link href="/" aria-label="UCA Sandbox home">
            <BrandLockup subtitle={portal} />
          </Link>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5" aria-label="Portal">
          {sections.map((section) => (
            <div key={section.label}>
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-brand-1"
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0 text-text-muted transition-colors group-hover:text-brand-1 dark:group-hover:text-brand-3" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
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
              className="flex items-center gap-1.5 text-sm font-medium text-brand-1 hover:text-brand-2 dark:text-brand-3"
            >
              <IconLogout className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
          <Link href="/" aria-label="UCA Sandbox home">
            <BrandLockup subtitle={portal} />
          </Link>
          <ThemeToggle />
        </header>
        <nav
          className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-3 py-2 md:hidden"
          aria-label="Portal mobile"
        >
          {allItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-text-muted hover:bg-surface-2 hover:text-text"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
