import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/rbac";
import { Avatar } from "@/components/creators/avatar";
import { Badge } from "@/components/ui/badge";
import { EliteBadge } from "@/components/elite-badge";
import { VerificationBadge } from "@/components/verification-badge";
import { SubmitWorkForm } from "@/components/peer-body/submit-work-form";
import { ReviewForm } from "@/components/peer-body/review-form";
import { getRoundForStudent } from "@/lib/peer-body";
import { PEER_BODY_STATUS } from "@/lib/constants";
import { formatDate } from "@/lib/format";

/**
 * A single Peer Body round: the prompt, everyone's submissions, and the review
 * controls. Hidden/draft work isn't a concept here — a submission is visible to
 * the round, which is the point of a feedback circle.
 */
export default async function PeerBodyRoundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireStudent();
  const { id } = await params;
  const data = await getRoundForStudent(id, user.id);
  if (!data) notFound();

  const { round, submissions } = data;
  const open = round.status === PEER_BODY_STATUS.REVIEWING;
  const mine = submissions.find((s) => s.isOwn);
  const reviewsMineReceived = mine?.reviews.length ?? 0;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/student/peer-body"
        className="text-sm text-text-muted hover:text-text"
      >
        ← All rounds
      </Link>

      <div className="hero-band relative mt-4 overflow-hidden rounded-2xl p-6">
        <div className="flex flex-wrap items-center gap-2">
          {open ? <Badge tone="success">Open</Badge> : <Badge tone="neutral">Closed</Badge>}
          {round.course?.name ? <Badge tone="brand">{round.course.name}</Badge> : null}
          {round.closesAt ? (
            <span className="hero-muted text-xs">Closes {formatDate(round.closesAt)}</span>
          ) : null}
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{round.title}</h1>
        <p className="hero-muted mt-2 text-sm">{round.prompt}</p>
      </div>

      {open ? (
        <div className="mt-6">
          <SubmitWorkForm
            roundId={round.id}
            initial={mine ? { title: mine.title, body: mine.body, linkUrl: mine.linkUrl } : null}
          />
          {mine ? (
            <p className="mt-2 text-xs text-text-muted">
              {reviewsMineReceived === 0
                ? "No reviews on your work yet."
                : `${reviewsMineReceived} review${reviewsMineReceived === 1 ? "" : "s"} on your work.`}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 space-y-5">
        <h2 className="eyebrow text-xs font-semibold">
          {submissions.length} submission{submissions.length === 1 ? "" : "s"}
        </h2>

        {submissions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center text-sm text-text-muted">
            No one has submitted yet. Yours can be first.
          </p>
        ) : (
          submissions.map((s) => (
            <article key={s.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-start gap-3">
                <Avatar
                  documentId={s.author.profile?.avatarDocumentId ?? null}
                  name={s.author.profile?.fullName ?? "UCA student"}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-sm font-semibold">
                    <span className="truncate">{s.author.profile?.fullName ?? "UCA student"}</span>
                    <EliteBadge memberNumber={s.author.eliteMemberNumber} />
                    <VerificationBadge tier={s.author.verificationTier} />
                    {s.isOwn ? <Badge tone="brand" className="ml-1">You</Badge> : null}
                  </p>
                  <p className="text-xs text-text-muted">
                    {s.author.username ? `@${s.author.username} · ` : ""}
                    {formatDate(s.createdAt)}
                  </p>
                </div>
              </div>

              <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{s.body}</p>
              {s.linkUrl ? (
                <a
                  href={s.linkUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-block text-sm text-brand-1 hover:underline dark:text-brand-3"
                >
                  {s.linkUrl}
                </a>
              ) : null}

              {s.reviews.length > 0 ? (
                <div className="mt-4 space-y-3 border-t border-border pt-4">
                  {s.reviews.map((r) => (
                    <div key={r.id} className="rounded-xl bg-surface-2 p-4">
                      <p className="text-xs font-semibold text-text-muted">
                        {r.reviewer.profile?.fullName ?? "A peer"}
                        {r.isOwn ? " (you)" : ""}
                      </p>
                      <dl className="mt-2 space-y-2 text-sm">
                        <div>
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                            What landed
                          </dt>
                          <dd className="mt-0.5">{r.whatLanded}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                            One thing to try
                          </dt>
                          <dd className="mt-0.5">{r.oneSuggestion}</dd>
                        </div>
                        {r.oneQuestion ? (
                          <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                              A question
                            </dt>
                            <dd className="mt-0.5">{r.oneQuestion}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                  ))}
                </div>
              ) : null}

              {open && !s.isOwn ? (
                <div className="mt-4 border-t border-border pt-4">
                  <ReviewForm submissionId={s.id} alreadyReviewed={!s.canReview} />
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
