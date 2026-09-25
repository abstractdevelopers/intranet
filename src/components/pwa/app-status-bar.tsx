"use client";

import { useEffect, useState } from "react";
import { Crest } from "@/components/crest";
import { isInstalledApp } from "@/lib/display-mode";

/**
 * In-app status bar — installed app only, and never on the splash.
 *
 * The manifest launches in `fullscreen`, so the app draws under the OS status
 * bar and there is nothing to show the time or the app identity. Rather than
 * hand that space to the OS (which looks doubled in `standalone`), the app
 * draws its own band: the UCA mark, the academy name, and a live clock.
 *
 * Scoped to `.pwa-installed` in CSS, so the website never renders it. The
 * splash and the refresh preloader sit above it (z-index), so it appears only
 * once the app itself is on screen — which is the point.
 */
export function AppStatusBar({ portal }: { portal: string }) {
  // Empty until mount so the server-rendered HTML and the first client paint
  // agree — a clock rendered during hydration would mismatch.
  const [time, setTime] = useState("");

  useEffect(() => {
    if (!isInstalledApp()) return;

    const tick = () =>
      setTime(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
      );
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="app-status-bar" aria-hidden>
      <span className="app-status-bar__brand">
        <Crest className="app-status-bar__mark" />
        <span className="app-status-bar__name">UCA Sandbox</span>
        <span className="app-status-bar__portal">{portal}</span>
      </span>
      <span className="app-status-bar__clock">{time || "\u00a0"}</span>
    </div>
  );
}
