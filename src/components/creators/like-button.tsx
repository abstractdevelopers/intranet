"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconHeart } from "@/components/icons";

/** Like / unlike a project (#3). */
export function LikeButton({
  projectId,
  initialLiked,
  initialCount,
  size = "md",
}: {
  projectId: string;
  initialLiked: boolean;
  initialCount: number;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const res = await fetch("/api/student/projects/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return;
    setLiked(Boolean(data.liked));
    setCount(Number(data.count ?? count));
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={liked}
      aria-label={liked ? "Unlike this project" : "Like this project"}
      className={`inline-flex items-center gap-1.5 rounded-lg border font-semibold transition-colors disabled:opacity-50 ${
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"
      } ${
        liked
          ? "border-brand-1/40 bg-brand-3/20 text-brand-1 dark:text-brand-3"
          : "border-border text-text-muted hover:text-text"
      }`}
    >
      <IconHeart className={`h-4 w-4 ${liked ? "fill-current" : "opacity-60"}`} />
      {count}
    </button>
  );
}
