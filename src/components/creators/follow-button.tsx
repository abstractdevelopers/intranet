"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconUserPlus, IconUserCheck } from "@/components/icons";

/**
 * Follow / unfollow toggle (#3). When the other student follows the viewer but
 * the viewer doesn't follow back, the label reads "Follow back".
 */
export function FollowButton({
  userId,
  initialFollowing,
  followsYou = false,
  size = "md",
}: {
  userId: string;
  initialFollowing: boolean;
  /** Whether the target follows the viewer — drives the "Follow back" label. */
  followsYou?: boolean;
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

  const iconDims = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const label = busy ? "…" : following ? "Following" : followsYou ? "Follow back" : "Follow";

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={following}
        className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50 ${
          size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
        } ${
          following
            ? "border border-border bg-surface text-text-muted hover:border-red-300 hover:text-red-600 dark:hover:text-red-400"
            : "bg-brand-1 text-white hover:bg-brand-2"
        }`}
      >
        {following ? (
          <IconUserCheck className={iconDims} />
        ) : (
          <IconUserPlus className={iconDims} />
        )}
        {label}
      </button>
      {error ? <span className="text-xs text-red-600 dark:text-red-400">{error}</span> : null}
    </span>
  );
}

