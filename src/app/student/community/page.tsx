import Link from "next/link";
import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { CourseMark } from "@/components/course-mark";
import { IconCommunication, IconArrowRight } from "@/components/icons";
import { getStudentPathway, getStudentCommunities } from "@/lib/communities";
import { PATHWAY_LABELS, type Pathway } from "@/lib/constants";

export const metadata = { title: "Communities" };

export default async function CommunityPage() {
  const user = await requireStudent();

  const [pathway, communities, courses] = await Promise.all([
    getStudentPathway(user.id),
    getStudentCommunities(user.id),
    db.enrollment.findMany({
      where: { userId: user.id, status: "ACCEPTED" },
      include: { course: { select: { id: true, name: true, slug: true, type: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const general = communities.filter((c) => !c.pathway);
  const pathwayCommunities = communities.filter((c) => c.pathway);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <p className="eyebrow">Communities</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Your communities</h1>
        <p className="mt-1 max-w-xl text-sm text-text-muted">
          Your community links are tied to your pathway, so you always land in the right
          places without having to work out where you belong.
        </p>
        <Link
          href="/student/community/feed"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-1 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-2"
        >
          <IconCommunication className="h-4 w-4" />
          Open the discussion feed
        </Link>
      </header>

      {/* Pathway card */}
      <section aria-label="Your pathway">
        <p className="eyebrow">01 — Your pathway</p>
        <Card className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">
                {pathway.label ?? "Pathway not set yet"}
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                {pathway.label
                  ? `Your compulsory foundations plus ${pathway.label}.`
                  : "Your pathway is set when your elective is approved."}
              </p>
            </div>
            {pathway.pathway ? (
              <Badge tone="brand">{PATHWAY_LABELS[pathway.pathway as Pathway]}</Badge>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {courses.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <CourseMark slug={e.course.slug} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{e.course.name}</p>
                  <p className="text-xs uppercase tracking-wide text-text-muted">
                    {e.course.type === "COMPULSORY" ? "Compulsory" : "Elective"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* General academy community */}
      <section aria-label="Academy community">
        <p className="eyebrow">02 — Academy-wide</p>
        <div className="mt-4 space-y-3">
          {general.length === 0 ? (
            <EmptyState
              title="No academy community yet"
              body="The academy-wide community link will appear here once set up."
            />
          ) : (
            general.map((c) => <CommunityRow key={c.id} community={c} />)
          )}
        </div>
      </section>

      {/* Pathway community */}
      <section aria-label="Pathway community">
        <p className="eyebrow">03 — Your pathway community</p>
        <div className="mt-4 space-y-3">
          {pathwayCommunities.length === 0 ? (
            <EmptyState
              title={
                pathway.label
                  ? `No ${pathway.label} community yet`
                  : "Choose a pathway to join its community"
              }
              body={
                pathway.label
                  ? "Your pathway community will appear here once it's set up."
                  : "Once your elective is approved, your pathway community link appears here."
              }
            />
          ) : (
            pathwayCommunities.map((c) => <CommunityRow key={c.id} community={c} />)
          )}
        </div>
      </section>
    </div>
  );
}

function CommunityRow({
  community,
}: {
  community: {
    id: string;
    name: string;
    description: string | null;
    platform: string;
    url: string;
  };
}) {
  return (
    <a
      href={community.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-4 transition-colors hover:border-brand-1/40"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-3/25 text-brand-1 dark:text-brand-3">
        <IconCommunication className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{community.name}</span>
        {community.description ? (
          <span className="mt-0.5 block text-sm text-text-muted">{community.description}</span>
        ) : null}
        <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          {community.platform}
        </span>
      </span>
      <IconArrowRight className="h-4.5 w-4.5 shrink-0 text-text-muted" />
    </a>
  );
}
