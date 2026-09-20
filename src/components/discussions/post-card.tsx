"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/creators/avatar";
import { VerifiedName } from "@/components/verification-badge";
import { IconHeart, IconCommunication, IconUsers, IconLock } from "@/components/icons";

export type FeedPostView = {
  id: string;
  title: string | null;
  body: string;
  pathway: string | null;
  pinned: boolean;
  createdAt: string;
  author: {
    id: string;
    username: string | null;
    verificationTier: string | null;
    profile: { fullName: string | null; avatarDocumentId: string | null } | null;
  };
  replyCount: number;
  likeCount: number;
  liked: boolean;
};

export function PostCard({
  post,
  currentUserId,
  showPathwayBadge = true,
}: {
  post: FeedPostView;
  currentUserId: string;
  showPathwayBadge?: boolean;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const authorName = post.author.profile?.fullName ?? post.author.username ?? "Member";
  const isOwn = post.author.id === currentUserId;

  async function toggleLike() {
    // Optimistic: the feed stays responsive, then reconciles with the server.
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    const res = await fetch(`/api/student/discussions/${post.id}/like`, { method: "POST" });
    if (!res.ok) {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
      return;
    }
    const data = await res.json().catch(() => null);
    if (data && typeof data.count === "number") {
      setLiked(data.liked);
      setLikeCount(data.count);
    }
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/student/discussions/${post.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    }
    setConfirmingDelete(false);
  }

  return (
    <article className="rounded-xl border border-border bg-surface p-5">
      <header className="flex items-start gap-3">
        <Avatar
          documentId={post.author.profile?.avatarDocumentId ?? null}
          name={authorName}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            <VerifiedName name={authorName} tier={post.author.verificationTier} />
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
            <span>{formatWhen(post.createdAt)}</span>
            {showPathwayBadge ? (
              <span className="inline-flex items-center gap-1">
                <span aria-hidden>·</span>
                {post.pathway ? (
                  <>
                    <IconUsers className="h-3 w-3" />
                    <span>{post.pathway.replaceAll("_", " ").toLowerCase()}</span>
                  </>
                ) : (
                  <>
                    <IconCommunication className="h-3 w-3" />
                    <span>academy</span>
                  </>
                )}
              </span>
            ) : null}
            {post.pinned ? (
              <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-brand-1 dark:text-brand-3">
                <IconLock className="h-3 w-3" /> Pinned
              </span>
            ) : null}
          </p>
        </div>
        {isOwn ? (
          confirmingDelete ? (
            <span className="flex items-center gap-2 text-xs">
              <button onClick={remove} disabled={busy} className="font-semibold text-red-600 hover:underline dark:text-red-400">
                {busy ? "Deleting…" : "Delete"}
              </button>
              <button onClick={() => setConfirmingDelete(false)} className="text-text-muted hover:text-text">
                Cancel
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="text-xs text-text-muted hover:text-red-600 dark:hover:text-red-400"
            >
              Delete
            </button>
          )
        ) : null}
      </header>

      {post.title ? (
        <h3 className="mt-3 text-base font-semibold">
          <Link href={`/student/community/feed/${post.id}`} className="hover:text-brand-1 dark:hover:text-brand-3">
            {post.title}
          </Link>
        </h3>
      ) : null}
      <p className="mt-2 whitespace-pre-wrap text-sm text-text">{post.body}</p>

      <footer className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-sm">
        <button
          onClick={toggleLike}
          aria-pressed={liked}
          className={`inline-flex items-center gap-1.5 transition-colors ${
            liked ? "font-semibold text-brand-1 dark:text-brand-3" : "text-text-muted hover:text-text"
          }`}
        >
          <IconHeart className="h-4 w-4" />
          {likeCount > 0 ? likeCount : "Like"}
        </button>
        <Link
          href={`/student/community/feed/${post.id}`}
          className="inline-flex items-center gap-1.5 text-text-muted transition-colors hover:text-text"
        >
          <IconCommunication className="h-4 w-4" />
          {post.replyCount > 0 ? `${post.replyCount} ${post.replyCount === 1 ? "reply" : "replies"}` : "Reply"}
        </Link>
      </footer>
    </article>
  );
}

/** Compact relative time — the feed reads better as "2h ago" than a full date. */
function formatWhen(iso: string) {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" });
}