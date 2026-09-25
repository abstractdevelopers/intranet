import Link from "next/link";
import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { PeerBodyRoundForm } from "@/components/admin/peer-body-round-form";
import { RoundStatusButton } from "@/components/admin/round-status-button";
import { PEER_BODY_STATUS, PATHWAY_LABELS, type Pathway } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Peer Body" };

/** Staff view: open rounds and see how many students are taking part. */
export default async function AdminPeerBodyPage() {
  await requireStaff();

  const [rounds, courses] = await Promise.all([
    db.peerBodyRound.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        prompt: true,
        status: true,
        pathway: true,
        closesAt: true,
        createdAt: true,
        course: { select: { name: true } },
        facilitator: { select: { profile: { select: { fullName: true } } } },
        _count: { select: { submissions: true } },
      },
    }),
    db.course.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Review counts in one grouped query rather than per round.
  const reviewCounts = await db.peerBodyReview.groupBy({
    by: ["submissionId"],
    _count: { _all: true },
  });
  const submissions = await db.peerBodySubmission.findMany({
    select: { id: true, roundId: true },
  });
  const roundOf = new Map(submissions.map((s) => [s.id, s.roundId]));
  const reviewsByRound = new Map<string, number>();
  for (const rc of reviewCounts) {
    const roundId = roundOf.get(rc.submissionId);
    if (roundId) reviewsByRound.set(roundId, (reviewsByRound.get(roundId) ?? 0) + rc._count._all);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Peer Body</h1>
        <p className="mt-1 text-sm text-text-muted">
          Open a round with a prompt, and students submit work and review each other with three
          short, kindness-forward questions. Close a round to freeze it as an archive.
        </p>
      </header>

      <Card className="p-6">
        <p className="eyebrow">New round</p>
        <div className="mt-4">
          <PeerBodyRoundForm courses={courses} />
        </div>
      </Card>

      <section>
        <p className="eyebrow">Rounds</p>
        {rounds.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No rounds yet" body="Rounds you open will appear here." />
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {rounds.map((round) => (
              <div key={round.id} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold">{round.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-text-muted">{round.prompt}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {round.status === PEER_BODY_STATUS.REVIEWING ? (
                      <Badge tone="success">Open</Badge>
                    ) : (
                      <Badge tone="neutral">Closed</Badge>
                    )}
                    <RoundStatusButton roundId={round.id} status={round.status} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                  <span>{round.course?.name ?? "Academy-wide"}</span>
                  {round.pathway ? (
                    <span>{PATHWAY_LABELS[round.pathway as Pathway] ?? round.pathway}</span>
                  ) : null}
                  <span>{round._count.submissions} submission(s)</span>
                  <span>{reviewsByRound.get(round.id) ?? 0} review(s)</span>
                  {round.closesAt ? <span>Closes {formatDate(round.closesAt)}</span> : null}
                  <span>
                    Opened by {round.facilitator.profile?.fullName ?? "staff"} ·{" "}
                    {formatDate(round.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-text-muted">
        Students see rounds on their courses under{" "}
        <Link href="/admin/courses" className="text-brand-1 hover:underline dark:text-brand-3">
          Courses
        </Link>
        .
      </p>
    </div>
  );
}
