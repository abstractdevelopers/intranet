import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { AppSplash } from "@/components/pwa/app-splash";
import { AppPreloader } from "@/components/pwa/app-preloader";
import { APPLE_SPLASH_IMAGES } from "@/lib/pwa";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "UCA Sandbox", template: "%s · UCA Sandbox" },
  description: "UCA Sandbox — the digital academy platform.",
  applicationName: "UCA Sandbox",
  // iOS installs use these; Android/desktop read the web manifest.
  appleWebApp: {
    capable: true,
    title: "UCA Sandbox",
    // black-translucent lets content sit under the status bar for a
    // full-screen, chrome-free launch.
    statusBarStyle: "black-translucent",
    startupImage: APPLE_SPLASH_IMAGES,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#570e83",
  colorScheme: "light dark",
  // cover draws into the notch/safe areas so an installed app has no band of
  // system chrome above it.
  viewportFit: "cover",
};

// Prevent a flash of the wrong theme before hydration.
const themeInit = `(function(){try{var t=localStorage.getItem("uca-theme");var d=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

// Mark the document when running as the installed app, before first paint.
// The launch splash and full-screen safe-area padding are scoped to this
// class, so the normal website never shows a splash and needs no notch
// padding. Must match isInstalledApp() in src/lib/display-mode.ts.
const installedInit = `(function(){try{var n=window.navigator;var modes=["fullscreen","standalone","minimal-ui","window-controls-overlay"];var installed=n.standalone===true||modes.some(function(m){return window.matchMedia("(display-mode: "+m+")").matches;});if(installed)document.documentElement.classList.add("pwa-installed");}catch(e){}})();`;

// Skip the launch splash before first paint on a repeat launch, so reopening
// the installed app within the same session doesn't flash it again.
const splashSkip = `(function(){try{if(sessionStorage.getItem("uca-splash-shown")==="1")document.documentElement.classList.add("splash-skip");}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <script dangerouslySetInnerHTML={{ __html: installedInit }} />
        <script dangerouslySetInnerHTML={{ __html: splashSkip }} />
        {/*
          Next emits the standards-based `mobile-web-app-capable`, but iOS
          Safari still reads the apple-prefixed tag to launch fullscreen with
          no browser chrome.
        */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${poppins.variable} min-h-screen antialiased`}>
        <PwaProvider />
        <AppSplash />
        <AppPreloader />
        {children}
      </body>
    </html>
  );
}
