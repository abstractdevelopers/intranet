"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

type Community = {
  id: string;
  name: string;
  description: string | null;
  platform: string;
  url: string;
  pathway: string | null;
  order: number;
  isActive: boolean;
};

/** List and manage community links (#15, #16). */
export function CommunityList({ communities }: { communities: Community[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/communities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(data.error ?? "We couldn't save that change.");
      return;
    }
    router.refresh();
  }

  async function remove(community: Community) {
    if (!confirm(`Delete "${community.name}"? Students will stop seeing this link.`)) return;
    setBusyId(community.id);
    setError(null);
    const res = await fetch(`/api/admin/communities/${community.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      setError("We couldn't delete that community.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {communities.map((c) => (
        <div
          key={c.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{c.name}</span>
              <Badge tone="neutral">{c.platform.toLowerCase()}</Badge>
              {c.isActive ? (
                <Badge tone="success">active</Badge>
              ) : (
                <Badge tone="warning">disabled</Badge>
              )}
            </div>
            {c.description ? (
              <p className="mt-0.5 text-xs text-text-muted">{c.description}</p>
            ) : null}
            <a
              href={c.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate text-xs text-brand-1 underline-offset-2 hover:underline dark:text-brand-3"
            >
              {c.url}
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busyId === c.id}
              onClick={() => patch(c.id, { isActive: !c.isActive })}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-text disabled:opacity-50"
            >
              {c.isActive ? "Disable" : "Enable"}
            </button>
            <button
              type="button"
              disabled={busyId === c.id}
              onClick={() => {
                const url = prompt("New invite link:", c.url);
                if (url === null) return;
                if (!/^https?:\/\/.+/.test(url.trim())) {
                  setError("Enter a valid http(s) link.");
                  return;
                }
                patch(c.id, { url: url.trim() });
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-text disabled:opacity-50"
            >
              Edit link
            </button>
            <button
              type="button"
              disabled={busyId === c.id}
              onClick={() => remove(c)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:border-red-300 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}