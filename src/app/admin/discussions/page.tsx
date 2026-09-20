import Link from "next/link";
import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { VerifiedName } from "@/components/verification-badge";
import { DiscussionModeration } from "@/components/discussions/discussion-moderation";

export const metadata = { title: "Discussions" };

export default async function AdminDiscussionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; show?: string }>;
}) {
  await requireStaff();
  const { q, show } = await searchParams;
  const query = q?.trim() ?? "";
  const includeHidden = show === "hidden";

  const posts = await db.discussionPost.findMany({
    where: {
      ...(includeHidden ? {} : { status: "PUBLISHED" }),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { body: { contains: query, mode: "insensitive" } },
              { author: { profile: { fullName: { contains: query, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          verificationTier: true,
          profile: { select: { fullName: true, avatarDocumentId: true } },
        },
      },
      _count: { select: { replies: true, likes: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="eyebrow">Community</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Discussions</h1>
        <p className="mt-1 max-w-xl text-sm text-text-muted">
          Moderate the academy feed. Hiding is reversible and notifies the author;
          deleting is permanent. Both are written to the audit log.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <form method="get" className="flex-1">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search posts, text or author…"
            aria-label="Search discussions"
            className="w-full max-w-sm rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus:border-brand-1 focus:outline-2 focus:outline-brand-3"
          />
          {includeHidden ? <input type="hidden" name="show" value="hidden" /> : null}
        </form>
        <Link
          href={includeHidden ? "/admin/discussions" : "/admin/discussions?show=hidden"}
          className="text-sm font-medium text-brand-1 hover:text-brand-2 dark:text-brand-3"
        >
          {includeHidden ? "Show published only" : "Include hidden"}
        </Link>
      </div>

      <div className="space-y-3">
        {posts.length === 0 ? (
          <EmptyState
            title="No discussions found"
            body={query ? "Try a different search." : "Posts will appear here once students start talking."}
          />
        ) : (
          posts.map((post) => (
            <Card key={post.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    <VerifiedName
                      name={post.author.profile?.fullName ?? post.author.username ?? "Member"}
                      tier={post.author.verificationTier}
                    />
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {post.pathway ? post.pathway.replaceAll("_", " ").toLowerCase() : "academy"} ·{" "}
                    {post.createdAt.toLocaleString("en-NG", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {post._count.replies} replies · {post._count.likes} likes
                  </p>
                </div>
                <Badge tone={statusTone(post.status)}>{post.status.toLowerCase()}</Badge>
              </div>

              {post.title ? <h3 className="mt-3 text-sm font-semibold">{post.title}</h3> : null}
              <p className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{post.body}</p>

              {post.status === "HIDDEN" && post.hiddenReason ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                  Hidden: {post.hiddenReason}
                </p>
              ) : null}

              <div className="mt-4 border-t border-border pt-3">
                <DiscussionModeration
                  targetId={post.id}
                  target="POST"
                  status={post.status}
                  preview={(post.title ?? post.body).slice(0, 80)}
                />
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}