import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOnboardedStudent } from "@/lib/rbac";
import { getPostThread } from "@/lib/discussions";
import { PostCard } from "@/components/discussions/post-card";
import { ReplyForm } from "@/components/discussions/reply-form";
import { Avatar } from "@/components/creators/avatar";
import { VerifiedName } from "@/components/verification-badge";

export const metadata = { title: "Discussion" };

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireOnboardedStudent();
  const { id } = await params;

  // Access is enforced in the helper: another pathway's thread is a 404, not a
  // 403, so the page never confirms that a hidden thread exists.
  const thread = await getPostThread(user.id, id);
  if (!thread) notFound();

  const { post, replies } = thread;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav className="text-xs text-text-muted">
        <Link href="/student/community/feed" className="hover:text-brand-1">
          Discussion feed
        </Link>
        <span className="mx-2">/</span>
        <span className="text-text">Thread</span>
      </nav>

      <PostCard
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

      <section aria-label="Replies" className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          {replies.length === 0
            ? "No replies yet"
            : `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
        </h2>

        {replies.map((reply) => {
          const name = reply.author.profile?.fullName ?? reply.author.username ?? "Member";
          return (
            <div key={reply.id} className="rounded-xl border border-border bg-surface p-4">
              <header className="flex items-start gap-3">
                <Avatar
                  documentId={reply.author.profile?.avatarDocumentId ?? null}
                  name={name}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    <VerifiedName name={name} tier={reply.author.verificationTier} />
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {new Date(reply.createdAt).toLocaleString("en-NG", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </header>
              <p className="mt-2 whitespace-pre-wrap text-sm text-text">{reply.body}</p>
            </div>
          );
        })}
      </section>

      <section aria-label="Add a reply" className="rounded-xl border border-border bg-surface p-5">
        <ReplyForm postId={post.id} />
      </section>
    </div>
  );
}