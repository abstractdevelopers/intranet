"use client";

import { useEffect, useState } from "react";
import { Crest } from "@/components/crest";

/**
 * Branded launch splash.
 *
 * Server-rendered so it covers the app shell on a cold start, then fades out
 * once the page is ready. It mirrors the iOS startup image (brand gradient +
 * centred mark), so installed and browser launches open on the same surface.
 *
 * Shown once per browser session: an inline script in the root layout adds
 * `.splash-skip` before first paint on a repeat visit, so a hard refresh never
 * flashes it. A short minimum stops it flickering on fast connections, and a
 * hard cap guarantees it never blocks the portal.
 */
const MIN_VISIBLE_MS = 700;
const MAX_VISIBLE_MS = 2600;
const SESSION_KEY = "uca-splash-shown";

export function AppSplash() {
  // Starts visible so the server HTML paints the splash before hydration.
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    sessionStorage.setItem(SESSION_KEY, "1");

    const start = Date.now();
    let timer: ReturnType<typeof setTimeout>;

    const finish = () => {
      const elapsed = Date.now() - start;
      timer = setTimeout(() => setHidden(true), Math.max(0, MIN_VISIBLE_MS - elapsed));
    };

    // Reveal as soon as the page has loaded, but never before MIN_VISIBLE_MS
    // and never later than MAX_VISIBLE_MS.
    const cap = setTimeout(() => setHidden(true), MAX_VISIBLE_MS);
    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });

    return () => {
      clearTimeout(timer);
      clearTimeout(cap);
      window.removeEventListener("load", finish);
    };
  }, []);

  return (
    <div
      className="app-splash"
      data-hidden={hidden ? "true" : "false"}
      role="status"
      aria-label="Loading UCA Sandbox"
    >
      {/* White mark on the dark brand band — no invert. */}
      <Crest className="app-splash__mark h-16 w-auto" />
      <span className="app-splash__word">UCA Sandbox</span>
      <span className="app-splash__bar" aria-hidden />
    </div>
  );
}
