"use client";

import { useEffect, useState } from "react";
import { Crest } from "@/components/crest";
import { isInstalledApp } from "@/lib/display-mode";

/**
 * Branded launch splash — installed app only.
 *
 * A website visitor never sees this; it exists to cover the cold-start gap
 * between the OS launch image and the first painted frame of the installed
 * PWA. The `.pwa-installed` class is set pre-paint by an inline script in the
 * root layout (and re-checked here after mount), which is what gates it.
 *
 * Shown once per session, with a short minimum so it can't flicker and a hard
 * cap so it can never block the portal.
 */
const MIN_VISIBLE_MS = 700;
const MAX_VISIBLE_MS = 2600;
const SESSION_KEY = "uca-splash-shown";

export function AppSplash() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // Not the installed app → the splash never rendered, so nothing to do.
    if (!isInstalledApp()) return;
    // Already shown this session: the layout's pre-paint script added
    // `.splash-skip`, and CSS hides it — nothing to do here either.
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

  // CSS scopes `.app-splash` to the installed app, so on the website this is
  // in the DOM but never painted; on a later launch it's already hidden.
  return (
    <div className="app-splash" data-hidden={hidden ? "true" : "false"} aria-hidden>
      {/* White mark on the dark brand band — no invert. */}
      <Crest className="app-splash__mark h-16 w-auto" />
      <span className="app-splash__word">UCA Sandbox</span>
      <span className="app-splash__bar" />
    </div>
  );
}
