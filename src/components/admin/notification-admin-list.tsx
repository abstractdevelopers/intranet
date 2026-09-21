"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Bulk clearing controls. The API refuses a filterless delete, so the UI makes
 * the scope explicit: a type, a cut-off date, or both.
 */
export function NotificationAdminList({
  notifications,
  types,
  activeType,
}: {
  notifications: { id: string; title: string; type: string }[];
  types: { type: string; count: number }[];
  activeType: string;
}) {
  const router = useRouter();
  const [type, setType] = useState(activeType);
  const [before, setBefore] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function clearFiltered() {
    if (!type && !before) {
      setError("Pick a notification type or a cut-off date first.");
      return;
    }
    const scope = [type ? `all "${type.replaceAll("_", " ").toLowerCase()}"` : "all types", before ? `older than ${before}` : ""]
      .filter(Boolean)
      .join(" · ");
    if (!confirm(`Delete ${scope}? This can't be undone.`)) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/admin/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(type ? { type } : {}),
        ...(before ? { before: new Date(before).toISOString() } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't delete those notifications.");
      return;
    }
    setMessage(`Deleted ${data.deleted} notification${data.deleted === 1 ? "" : "s"}.`);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <p className="text-sm font-semibold">Clear notifications</p>
      <p className="mt-1 text-xs text-text-muted">
        Remove notifications from student portals in bulk. Pick a type, a cut-off date, or both.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-52 flex-1">
          <label htmlFor="ntf-type" className="block text-xs font-semibold text-text-muted">
            Type
          </label>
          <select
            id="ntf-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="">— Any type —</option>
            {types.map((t) => (
              <option key={t.type} value={t.type}>
                {t.type.replaceAll("_", " ").toLowerCase()} ({t.count})
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-52 flex-1">
          <label htmlFor="ntf-before" className="block text-xs font-semibold text-text-muted">
            Created before
          </label>
          <input
            id="ntf-before"
            type="datetime-local"
            value={before}
            onChange={(e) => setBefore(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={clearFiltered}
          disabled={busy}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          {busy ? "Deleting…" : "Delete matching"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {message ? (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{message}</p>
      ) : null}
      <p className="mt-3 text-xs text-text-muted">
        {notifications.length} notification{notifications.length === 1 ? "" : "s"} shown on this page.
      </p>
    </div>
  );
}

/** Delete a single notification row. */
export function NotificationRowDelete({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm("Delete this notification from the student's portal?")) return;
    setBusy(true);
    await fetch(`/api/admin/notifications/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      className="shrink-0 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}