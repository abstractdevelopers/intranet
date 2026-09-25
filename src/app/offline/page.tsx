import Link from "next/link";
import { Crest } from "@/components/crest";
import { IconSpark } from "@/components/icons";

export const metadata = { title: "Offline" };

/**
 * Branded offline screen, precached by the service worker so it renders with
 * no connection. Deliberately self-contained: no data fetching, no client JS.
 */
export default function OfflinePage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-surface-2 px-6 text-center dark:bg-ink">
      {/* soft brand wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-1/10 to-transparent dark:from-brand-1/25"
      />

      <div className="relative flex flex-col items-center animate-rise">
        <Crest className="h-12 w-auto" invert />

        <span className="mt-6 flex h-11 w-11 items-center justify-center rounded-full bg-brand-3/25 text-brand-1 dark:text-brand-3">
          <IconSpark className="h-5 w-5" />
        </span>

        <p className="eyebrow mt-5">Connection lost</p>
        <h1 className="mt-2 text-xl font-bold tracking-tight">You&apos;re offline</h1>
        <p className="mt-2 max-w-sm text-sm text-text-muted">
          UCA Sandbox needs a connection to load your academy. Your saved pages are still
          available — reconnect to pick up where you left off.
        </p>

        <Link
          href="/student"
          className="mt-6 rounded-lg bg-brand-1 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-2"
        >
          Try again
        </Link>
      </div>

      <p className="relative mt-10 text-xs text-text-muted">UCA Sandbox · Offline</p>
    </div>
  );
}
