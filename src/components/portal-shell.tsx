"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { BrandLockup } from "./crest";
import { IconLogout, ICONS, type IconName } from "./icons";
import { VerificationBadge } from "./verification-badge";
import { EliteBadge } from "./elite-badge";
import { AppStatusBar } from "./pwa/app-status-bar";
import { MobileTabBar, type TabItem } from "./pwa/mobile-tab-bar";

export type NavItem = {
  href: string;
  label: string;
  /** Key into ICONS — a string so it survives the server→client boundary. */
  icon: IconName;
};

export type NavSection = { label: string; items: NavItem[] };

/**
 * The five primary destinations for the installed app's bottom bar. Everything
 * else lives behind "More". Kept to five so each target is a comfortable
 * thumb-sized tap.
 */
const MOBILE_TABS: TabItem[] = [
  { href: "/student", label: "Home", icon: "Dashboard" },
  { href: "/student/courses", label: "Courses", icon: "Courses" },
  { href: "/student/creators", label: "Creators", icon: "Students" },
  { href: "/student/notifications", label: "Alerts", icon: "Bell" },
  { href: "/student/profile", label: "You", icon: "Profile" },
];

/** Admin keeps its own primary tabs — the portals don't share destinations. */
const ADMIN_TABS: TabItem[] = [
  { href: "/admin", label: "Home", icon: "Dashboard" },
  { href: "/admin/students", label: "Students", icon: "Students" },
  { href: "/admin/courses", label: "Courses", icon: "Courses" },
  { href: "/admin/notifications", label: "Alerts", icon: "Bell" },
  { href: "/admin/settings", label: "Settings", icon: "Settings" },
];

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
  userEliteNumber,
  badges,
  children,
}: {
  portal: string;
  sections: NavSection[];
  userName: string;
  userRole: string;
  userTier?: string | null;
  /** Elite reclaim rank; renders the badge beside the name when set. */
  userEliteNumber?: number | null;
  /** Optional unread counts keyed by nav href, e.g. notifications. */
  badges?: Record<string, number>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const allItems = sections.flatMap((s) => s.items);
  // One winner across every section, so sibling sections can't double-highlight.
  const active = activeHref(pathname, allItems.map((i) => i.href));
  // The installed app gets the app-style chrome; the website keeps the header
  // strip. Chosen by the portal rather than sniffed from the URL.
  const tabs = portal.toLowerCase().includes("admin") ? ADMIN_TABS : MOBILE_TABS;

  return (
    <div className="flex min-h-screen">
      {/* In-app status bar — installed app only, drawn above everything. */}
      <AppStatusBar portal={portal} />
      <aside className="app-shell-sidebar hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
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
                  const badge = badges?.[item.href] ?? 0;
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
                      <span className="flex-1">{item.label}</span>
                      {badge > 0 ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-1 px-1.5 text-[11px] font-semibold text-white">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      ) : null}
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
              <EliteBadge memberNumber={userEliteNumber} />
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
        <header className="app-shell-header flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
          <Link href="/" aria-label="UCA Sandbox home">
            <BrandLockup subtitle={portal} />
          </Link>
          <ThemeToggle />
        </header>
        <nav
          className="app-shell-nav flex gap-1 overflow-x-auto border-b border-border bg-surface px-3 py-2 md:hidden"
          aria-label="Portal mobile"
        >
          {allItems.map((item) => {
            const isCurrent = active === item.href;
            const NavIcon = ICONS[item.icon];
            const badge = badges?.[item.href] ?? 0;
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
                {badge > 0 ? (
                  <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-brand-1 px-1 text-[10px] font-semibold text-white">
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <main className="app-shell-main flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>

      {/* Mobile app tab bar — installed app only; the website keeps the strip. */}
      <MobileTabBar tabs={tabs} sections={sections} badges={badges} />
    </div>
  );
}

