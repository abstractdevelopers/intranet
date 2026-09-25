import type { MetadataRoute } from "next";

/**
 * PWA manifest. Makes UCA Sandbox installable on Android and desktop; iOS
 * installs via Safari's Share → Add to Home Screen, using the apple-touch-icon
 * and startup images declared in the root layout.
 *
 * `display_override` prefers true fullscreen — no status bar, so no battery or
 * clock chrome — and falls back to standalone where the platform won't allow
 * it. Both background and theme colours are brand purple so the launch surface
 * matches the splash screens.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "UCA Sandbox",
    short_name: "UCA",
    description:
      "UCA Sandbox — the digital academy platform. Courses, portfolio and community in one place.",
    start_url: "/student",
    scope: "/",
    display: "standalone",
    display_override: ["fullscreen", "standalone"],
    orientation: "portrait",
    background_color: "#570e83",
    theme_color: "#570e83",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Dashboard", url: "/student" },
      { name: "My Courses", url: "/student/courses" },
      { name: "Notifications", url: "/student/notifications" },
    ],
  };
}
