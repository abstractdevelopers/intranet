import Link from "next/link";
import { requireOnboardedStudent } from "@/lib/rbac";
import { getVisibleFeeds, getFeedPosts } from "@/lib/discussions";
import { PATHWAY_LABELS, type Pathway } from "@/lib/constants";
import { PostComposer } from "@/components/discussions/post-composer";
import { PostCard } from "@/components/discussions/post-card";
import { EmptyState } from "@/components/ui/empty";

export const metadata = { title: "Feed" };

/**
 * The on-platform academy feed. `scope` selects a single feed (?scope=pathway
 * or ?scope=academy); without it both the general and the student's pathway
 * feed are merged into one timeline.
 */
export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const user = await requireOnboardedStudent();
  const { scope } = await searchParams;

  const feeds = await getVisibleFeeds(user.id);

  // An unknown or unauthorized scope falls back to the merged timeline rather
  // than leaking whether a pathway feed exists.
  const requested =
    scope === "academy"
      ? null
      : scope && Object.prototype.hasOwnProperty.call(PATHWAY_LABELS, scope)
        ? (scope as Pathway)
        : undefined;
  const allowed = requested === undefined || feeds.some((f) => f.pathway === requested);
  const activeScope = allowed ? requested : undefined;

  const posts = await getFeedPosts(user.id, { pathway: activeScope });

  const composerFeeds = feeds.map((f) => ({ pathway: f.pathway, label: f.label }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="eyebrow">Community</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Discussion feed</h1>
        <p className="mt-1 max-w-xl text-sm text-text-muted">
          Ask questions, share work, and talk with your cohort — all inside the academy.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Feed filter">
        <ScopeTab href="/student/community/feed" active={activeScope === undefined}>
          All
        </ScopeTab>
        {feeds.map((f) => (
          <ScopeTab
            key={f.pathway ?? "academy"}
            href={`/student/community/feed?scope=${f.pathway ?? "academy"}`}
            active={activeScope === f.pathway}
          >
            {f.label}
          </ScopeTab>
        ))}
      </nav>

      <PostComposer feeds={composerFeeds} defaultPathway={activeScope ?? null} />

      <div className="space-y-4">
        {posts.length === 0 ? (
          <EmptyState
            title="No discussions yet"
            body="Be the first to start a conversation in this feed."
          />
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              currentUserId={user.id}
              post={{
                id: post.id,
                title: post.title,
                body: post.body,
                pathway: post.pathway,
                pinned: post.pinned,
                createdAt: post.createdAt.toISOString(),
                author: post.author,
                replyCount: post._count.replies,
                likeCount: post._count.likes,
                liked: post.likes.length > 0,
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ScopeTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-brand-1 text-white"
          : "border border-border bg-surface text-text-muted hover:border-brand-1/40 hover:text-text"
      }`}
    >
      {children}
    </Link>
  );
}