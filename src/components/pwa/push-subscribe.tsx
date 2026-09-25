"use client";

import { useEffect, useState } from "react";
import { IconBell, IconClose } from "@/components/icons";

/**
 * Asks a signed-in student to allow browser notifications. Only appears when
 * the browser supports push, permission hasn't been decided, and the device
 * isn't already subscribed. Dismissal lasts for the visit, not forever.
 */

const DISMISS_KEY = "uca-push-dismissed";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalised);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function PushSubscribe() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    if (Notification.permission === "denied") return;

    // Only prompt when we aren't already subscribed.
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setShow(!sub && Notification.permission !== "granted"))
      .catch(() => setShow(false));
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setShow(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const res = await fetch("/api/student/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) throw new Error("save failed");
      setShow(false);
    } catch {
      setError("We couldn't enable notifications. You can try again later.");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-3/25 text-brand-1 dark:text-brand-3">
          <IconBell className="h-4.5 w-4.5" />
        </span>
        <div>
          <p className="text-sm font-semibold">Turn on notifications</p>
          <p className="mt-0.5 text-xs text-text-muted">
            Get graded work, deadlines and announcements straight to this device.
          </p>
          {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="rounded-lg bg-brand-1 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
        >
          {busy ? "Enabling…" : "Enable"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss notification prompt"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <IconClose className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
