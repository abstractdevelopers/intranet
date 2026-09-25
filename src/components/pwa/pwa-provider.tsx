"use client";

import { useEffect } from "react";

/**
 * Registers the service worker once per browser. Kept as a tiny client island
 * so the rest of the portal stays server-rendered.
 */
export function PwaProvider() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* Registration is best-effort; the portal works without it. */
    });
  }, []);

  return null;
}
