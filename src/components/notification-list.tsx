"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck } from "@/components/icons";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  createdAt: string;
  readAt: string | null;
};

export function NotificationList({
  notifications,
  formatDateTime,
}: {
  notifications: Notification[];
  formatDateTime: (d: string) => string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markAll() {
    setBusy(true);
    await fetch("/api/student/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    setBusy(false);
    router.refresh();
  }

  async function markOne(id: string) {
    await fetch("/api/student/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <>
      {unread > 0 ? (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs font-medium text-text-muted">{unread} unread</p>
          <button
            onClick={markAll}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:border-brand-1 hover:text-brand-1 disabled:opacity-50 dark:hover:text-brand-3"
          >
            <IconCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => !n.readAt && markOne(n.id)}
            className={`block w-full rounded-xl border border-border bg-surface p-4 text-left transition-colors ${
              n.readAt ? "opacity-60" : "hover:border-brand-1/40"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5">
                {!n.readAt ? (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-1 dark:bg-brand-3" aria-label="Unread" />
                ) : null}
                <div>
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body ? <p className="mt-0.5 text-sm text-text-muted">{n.body}</p> : null}
                </div>
              </div>
              <span className="shrink-0 text-xs text-text-muted">{formatDateTime(n.createdAt)}</span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
