"use client";

import { useEffect, useState } from "react";
import { IconClose, IconDownload, IconSpark } from "@/components/icons";

/**
 * Premium install prompt.
 *
 * Shown once per browser visit: Android/desktop Chrome exposes
 * `beforeinstallprompt` (captured here and replayed on click), while iOS Safari
 * never fires it — there the banner teaches the Share → Add to Home Screen
 * path instead. Dismissal is remembered only for the current visit, so the
 * invitation returns next time but never nags within one.
 */

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "uca-install-dismissed";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function InstallBanner() {
  const [promptEvent, setPromptEvent] = useState<PromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Decide after mount: reading browser state during render would desync
    // hydration, and a synchronous setState in the effect body would cascade.
    queueMicrotask(() => {
      if (cancelled) return;
      if (isStandalone()) return;
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
      if (isIos()) {
        setIosHint(true);
        setShow(true);
      }
    });

    function onPrompt(e: Event) {
      e.preventDefault();
      if (cancelled) return;
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
      setPromptEvent(e as PromptEvent);
      setShow(true);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice.catch(() => null);
    setShow(false);
  }

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="hero-band animate-rise relative mb-6 overflow-hidden rounded-2xl p-5 md:p-6" role="dialog" aria-label="Install the app">
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/12">
            <IconSpark className="h-5.5 w-5.5 text-brand-3" />
          </span>
          <div>
            <p className="hero-eyebrow text-[11px] font-semibold uppercase tracking-[0.18em]">
              UCA Sandbox app
            </p>
            <p className="mt-1 text-base font-semibold text-white">
              Install the academy on your device
            </p>
            <p className="hero-muted mt-1 max-w-lg text-sm">
              {iosHint
                ? "Tap the Share icon in Safari, then choose “Add to Home Screen”."
                : "Get full-screen access from your home screen or desktop, with instant notifications."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!iosHint ? (
            <button
              type="button"
              onClick={install}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-1 transition-colors hover:bg-brand-3"
            >
              <IconDownload className="h-4 w-4" /> Install
            </button>
          ) : null}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <IconClose className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
