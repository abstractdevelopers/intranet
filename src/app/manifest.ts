import type { MetadataRoute } from "next";

/**
 * PWA manifest. Makes UCA Sandbox installable on Android, desktop and iOS
 * (iOS installs via Safari's Share → Add to Home Screen; it ignores
 * `beforeinstallprompt`, hence the manual path in InstallBanner).
 *
 * `display: "fullscreen"` launches the installed app with no browser or OS
 * chrome at all; `display_override` keeps a graceful fallback chain for
 * platforms that refuse it (iOS has no true fullscreen — it honours
 * standalone and keeps a translucent status bar). Both background and theme
 * colours are brand purple so the launch surface matches the splash screens.
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
    display: "fullscreen",
    display_override: ["fullscreen", "standalone", "minimal-ui"],
    orientation: "portrait",
    theme_color: "#570e83",
    background_color: "#570e83",
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
