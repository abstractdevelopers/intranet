"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconClose, ICONS, type IconName } from "@/components/icons";

export type TabItem = { href: string; label: string; icon: IconName };
export type TabSection = { label: string; items: TabItem[] };

/** Longest matching href wins, so the portal root doesn't light up everywhere. */
function activeHref(pathname: string, hrefs: string[]): string | null {
  const matches = hrefs.filter((h) => pathname === h || pathname.startsWith(`${h}/`));
  if (matches.length === 0) return null;
  return matches.reduce((best, h) => (h.length > best.length ? h : best));
}

/**
 * The mobile app tab bar — installed app only.
 *
 * A horizontal strip of a dozen links is the single biggest thing that makes
 * the portal feel like a website on a phone: it scrolls sideways, it sits at
 * the top out of thumb reach, and it pushes content down. In the installed app
 * the primary destinations move to a fixed bar at the bottom and everything
 * else moves into a sheet behind "More".
 *
 * Scoped to `.pwa-installed` in CSS, so the browser experience is unchanged.
 */
export function MobileTabBar({
  tabs,
  sections,
  badges,
}: {
  tabs: TabItem[];
  sections: TabSection[];
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const tabHrefs = tabs.map((t) => t.href);
  const active = activeHref(pathname, sections.flatMap((s) => s.items).map((i) => i.href));
  // "More" reads as current whenever the page isn't one of the primary tabs.
  const moreActive = active !== null && !tabHrefs.includes(active);

  // Lock the body while the sheet is open.
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

  return (
    <>
      <nav className="app-tabbar" aria-label="Portal">
        {tabs.map((tab) => {
          const TabIcon = ICONS[tab.icon];
          const isCurrent = active === tab.href;
          const badge = badges?.[tab.href] ?? 0;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isCurrent ? "page" : undefined}
              className="app-tabbar__item"
              data-active={isCurrent ? "true" : "false"}
            >
              <span className="app-tabbar__icon">
                <TabIcon className="h-[22px] w-[22px]" />
                {badge > 0 ? (
                  <span className="app-tabbar__badge">{badge > 9 ? "9+" : badge}</span>
                ) : null}
              </span>
              <span className="app-tabbar__label">{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-expanded={sheetOpen}
          className="app-tabbar__item"
          data-active={moreActive ? "true" : "false"}
        >
          <span className="app-tabbar__icon">
            <ICONS.More className="h-[22px] w-[22px]" />
          </span>
          <span className="app-tabbar__label">More</span>
        </button>
      </nav>

      {sheetOpen ? (
        <div className="app-sheet" role="dialog" aria-modal="true" aria-label="All sections">
          <button
            type="button"
            className="app-sheet__scrim"
            aria-label="Close"
            onClick={() => setSheetOpen(false)}
          />
          <div className="app-sheet__panel">
            <div className="app-sheet__grabber" aria-hidden />
            <div className="app-sheet__head">
              <p className="text-sm font-semibold">All sections</p>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className="text-text-muted hover:text-text"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>
            <div className="app-sheet__body">
              {sections.map((section) => (
                <div key={section.label} className="app-sheet__group">
                  <p className="app-sheet__group-label">{section.label}</p>
                  <div className="app-sheet__grid">
                    {section.items.map((item) => {
                      const ItemIcon = ICONS[item.icon];
                      const isCurrent = active === item.href;
                      const badge = badges?.[item.href] ?? 0;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={isCurrent ? "page" : undefined}
                          className="app-sheet__item"
                          data-active={isCurrent ? "true" : "false"}
                          onClick={() => setSheetOpen(false)}
                        >
                          <ItemIcon className="h-5 w-5 shrink-0" />
                          <span className="truncate">{item.label}</span>
                          {badge > 0 ? <span className="app-sheet__badge">{badge}</span> : null}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
