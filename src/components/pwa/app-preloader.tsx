"use client";

import { useEffect, useState } from "react";

/**
 * Brand-purple refresh spinner for the installed app.
 *
 * A hard refresh reloads the whole document, so this covers the gap between
 * the old page going away and the new one painting, instead of a white flash.
 * The CSS gates it on `.pwa-installed.splash-skip`, so the website never shows
 * it and the very first launch shows the full splash instead. Fades out on
 * `load` and always clears itself shortly after, so it can never get stuck.
 */
const MIN_VISIBLE_MS = 350;
const MAX_VISIBLE_MS = 3000;

export function AppPreloader() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const start = Date.now();
    let timer: ReturnType<typeof setTimeout>;

    const finish = () => {
      const elapsed = Date.now() - start;
      timer = setTimeout(() => setDone(true), Math.max(0, MIN_VISIBLE_MS - elapsed));
    };

    const cap = setTimeout(() => setDone(true), MAX_VISIBLE_MS);
    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });

    return () => {
      clearTimeout(timer);
      clearTimeout(cap);
      window.removeEventListener("load", finish);
    };
  }, []);

  return (
    <div className="app-preloader" data-done={done ? "true" : "false"} aria-hidden>
      <span className="app-preloader__ring" />
    </div>
  );
}
