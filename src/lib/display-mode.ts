/**
 * Display-mode helpers for the installed app.
 *
 * An installed PWA can run in several modes; the browser tab is `browser`.
 * Anything else means the user launched the installed app rather than visiting
 * the site, which is what gates the launch splash and safe-area padding.
 *
 * Server-side rendering has no `window`, so these always guard for it.
 */

/** Non-browser display modes, i.e. launched from the home screen / desktop. */
const INSTALLED_MODES = ["fullscreen", "standalone", "minimal-ui", "window-controls-overlay"];

/**
 * True when running as the installed app. Covers the CSS display-mode media
 * queries plus iOS Safari's legacy `navigator.standalone` flag, which is the
 * only signal an iOS home-screen app exposes.
 */
export function isInstalledApp(): boolean {
  if (typeof window === "undefined") return false;
  if ((window.navigator as unknown as { standalone?: boolean }).standalone === true) return true;
  return INSTALLED_MODES.some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches);
}

/**
 * Marks the document when running installed, so CSS can apply full-screen
 * safe-area padding. Returns a cleanup that removes the listener.
 */
export function watchInstalledApp(onChange: (installed: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const queries = INSTALLED_MODES.map((mode) => window.matchMedia(`(display-mode: ${mode})`));
  const update = () => onChange(isInstalledApp());
  queries.forEach((q) => q.addEventListener("change", update));
  return () => queries.forEach((q) => q.removeEventListener("change", update));
}
