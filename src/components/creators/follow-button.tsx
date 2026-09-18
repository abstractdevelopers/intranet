"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Follow / unfollow toggle (#3). */
export function FollowButton({
  userId,
  initialFollowing,
  size = "md",
}: {
  userId: string;
  initialFollowing: boolean;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/student/creators/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't update that. Please try again.");
      return;
    }
    setFollowing(Boolean(data.following));
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={following}
        className={`rounded-lg font-semibold transition-colors disabled:opacity-50 ${
          size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
        } ${
          following
            ? "border border-border bg-surface text-text-muted hover:border-red-300 hover:text-red-600 dark:hover:text-red-400"
            : "bg-brand-1 text-white hover:bg-brand-2"
        }`}
      >
        {busy ? "…" : following ? "Following" : "Follow"}
      </button>
      {error ? <span className="text-xs text-red-600 dark:text-red-400">{error}</span> : null}
    </span>
  );
}
