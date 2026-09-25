import Link from "next/link";
import { requireStudent } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { IconUsers, IconWriting, IconCheckCircle } from "@/components/icons";
import { getStudentRounds, getReviewsReceived } from "@/lib/peer-body";
import { PEER_BODY_STATUS, PATHWAY_LABELS, type Pathway } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Peer Body" };

/**
 * Peer Body hub: the rounds a student can take part in, plus the reviews they
 * have received. Structured peer feedback, not a comment thread — each round
 * has a prompt and each review has three short fields.
 */
export default async function PeerBodyPage() {
  const user = await requireStudent();

  const [rounds, received] = await Promise.all([
    getStudentRounds(user.id),
    getReviewsReceived(user.id, 10),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="hero-band relative overflow-hidden rounded-2xl p-6 md:p-8">
        <p className="hero-eyebrow text-[11px] font-semibold uppercase tracking-[0.18em]">
          Feedback circle
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">Peer Body</h1>
        <p className="hero-muted mt-2 max-w-2xl text-sm">
          Share your work with your cohort and review each other. Every review has three short
          prompts — what landed, one thing to try, and a question — so feedback stays specific and
          kind.
        </p>
      </div>

      <section className="mt-8">
        <h2 className="eyebrow text-xs font-semibold">Open rounds</h2>
        <div className="mt-3 space-y-3">
          {rounds.length === 0 ? (
            <EmptyState
              title="No rounds yet"
              body="When your facilitator opens a round, it'll appear here for you to submit and review."
            />
          ) : (
            rounds.map((round) => {
              const closed = round.status === PEER_BODY_STATUS.CLOSED;
              return (
                <Link
                  key={round.id}
                  href={`/student/peer-body/${round.id}`}
                  className="block rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-brand-1/50 hover:bg-surface-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold">{round.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-text-muted">{round.prompt}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {closed ? (
                        <Badge tone="neutral">Closed</Badge>
                      ) : (
                        <Badge tone="success">Open</Badge>
                      )}
                      <Badge tone="brand">
                        <IconUsers className="mr-1 h-3.5 w-3.5" />
                        {round.submissionCount}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                    {round.courseName ? <span>{round.courseName}</span> : null}
                    {round.pathway ? (
                      <span>{PATHWAY_LABELS[round.pathway as Pathway] ?? round.pathway}</span>
                    ) : null}
                    {round.closesAt ? <span>Closes {formatDate(round.closesAt)}</span> : null}
                    <span className="inline-flex items-center gap-1">
                      {round.viewerSubmitted ? (
                        <>
                          <IconCheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          You submitted
                        </>
                      ) : (
                        <>
                          <IconWriting className="h-3.5 w-3.5" />
                          Not submitted yet
                        </>
                      )}
                    </span>
                    {round.viewerReviews > 0 ? <span>{round.viewerReviews} review(s) left</span> : null}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="eyebrow text-xs font-semibold">Reviews you&apos;ve received</h2>
        <div className="mt-3 space-y-3">
          {received.length === 0 ? (
            <EmptyState
              title="No reviews yet"
              body="Submit work to a round and your peers can leave you feedback."
            />
          ) : (
            received.map((review) => (
              <div key={review.id} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {review.reviewer.profile?.fullName ?? "A peer"}
                    <span className="ml-2 font-normal text-text-muted">
                      on “{review.submission.title}”
                    </span>
                  </p>
                  <span className="text-xs text-text-muted">{formatDate(review.createdAt)}</span>
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                      What landed
                    </dt>
                    <dd className="mt-0.5">{review.whatLanded}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                      One thing to try
                    </dt>
                    <dd className="mt-0.5">{review.oneSuggestion}</dd>
                  </div>
                  {review.oneQuestion ? (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                        A question for you
                      </dt>
                      <dd className="mt-0.5">{review.oneQuestion}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
