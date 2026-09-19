"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { BrandLockup } from "./crest";
import { IconLogout, ICONS, type IconName } from "./icons";
import { VerificationBadge } from "./verification-badge";

export type NavItem = {
  href: string;
  label: string;
  /** Key into ICONS — a string so it survives the server→client boundary. */
  icon: IconName;
};

export type NavSection = { label: string; items: NavItem[] };

/**
 * Highlight only the most specific matching nav item. A plain prefix test would
 * light up the portal root (`/student`) on every subpage, since it is a prefix
 * of them all — so the winner is the longest href that matches the path.
 */
function activeHref(pathname: string, hrefs: string[]): string | null {
  const matches = hrefs.filter(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  );
  if (matches.length === 0) return null;
  return matches.reduce((best, href) => (href.length > best.length ? href : best));
}

export function PortalShell({
  portal,
  sections,
  userName,
  userRole,
  userTier,
  children,
}: {
  portal: string;
  sections: NavSection[];
  userName: string;
  userRole: string;
  userTier?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const allItems = sections.flatMap((s) => s.items);
  // One winner across every section, so sibling sections can't double-highlight.
  const active = activeHref(pathname, allItems.map((i) => i.href));

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
                {section.items.map((item) => {
                  const isCurrent = active === item.href;
                  const NavIcon = ICONS[item.icon];
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isCurrent ? "page" : undefined}
                      className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-1 ${
                        isCurrent
                          ? "bg-brand-3/25 text-brand-1 dark:text-brand-3"
                          : "text-text-muted hover:bg-surface-2 hover:text-text"
                      }`}
                    >
                      <NavIcon
                        className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                          isCurrent
                            ? "text-brand-1 dark:text-brand-3"
                            : "text-text-muted group-hover:text-brand-1 dark:group-hover:text-brand-3"
                        }`}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="space-y-3 border-t border-border px-4 py-4">
          <ThemeToggle />
          <div className="text-sm">
            <p className="flex items-center gap-1.5 font-medium">
              <span className="truncate">{userName}</span>
              <VerificationBadge tier={userTier} />
            </p>
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
          {allItems.map((item) => {
            const isCurrent = active === item.href;
            const NavIcon = ICONS[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                  isCurrent
                    ? "bg-brand-3/25 text-brand-1 dark:text-brand-3"
                    : "text-text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                <NavIcon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
