"use client";

import { useEffect, useRef } from "react";

/**
 * Plays the branded notification chime when a push arrives while the app is in
 * front, and mirrors the unread count onto the installed app's badge.
 *
 * The service worker suppresses the OS tone in that case (see public/sw.js), so
 * this is the sound the student actually hears. Browsers block audio before any
 * user gesture, so the element is "unlocked" with a muted play on the first
 * interaction; until then a chime is skipped rather than throwing.
 */

const CHIME_SRC = "/sounds/notification.wav";

export function NotificationSound({ unreadCount }: { unreadCount: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const audio = new Audio(CHIME_SRC);
    audio.preload = "auto";
    audio.volume = 0.6;
    audioRef.current = audio;

    // Unlock audio on the first real interaction so a later push can be heard.
    const unlock = () => {
      const el = audioRef.current;
      if (unlockedRef.current || !el) return;
      el.muted = true;
      el.play()
        .then(() => {
          el.pause();
          el.currentTime = 0;
          el.muted = false;
          unlockedRef.current = true;
        })
        .catch(() => {
          el.muted = false; // Still locked; try again on the next gesture.
        });
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    // The SW asks us to chime only when a window is focused and visible.
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "uca-push") return;
      if (document.visibilityState !== "visible") return;
      const el = audioRef.current;
      if (!el || !unlockedRef.current) return;
      el.currentTime = 0;
      el.play().catch(() => {
        /* Autoplay blocked; the system notification already carried the alert. */
      });
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  // Keep the installed app's badge aligned with the server-rendered unread
  // count (no extra request; the layout already computed it).
  useEffect(() => {
    if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) return;
    if (unreadCount > 0) navigator.setAppBadge(unreadCount).catch(() => {});
    else navigator.clearAppBadge?.().catch(() => {});
  }, [unreadCount]);

  return null;
}
