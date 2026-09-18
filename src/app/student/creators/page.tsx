import Link from "next/link";
import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Avatar } from "@/components/creators/avatar";
import { FollowButton } from "@/components/creators/follow-button";
import { IconCompass, IconUsers, IconCourses } from "@/components/icons";
import { searchCreators, getFollowedCreators } from "@/lib/creators";
import { PATHWAY_LABELS, PATHWAYS, type Pathway } from "@/lib/constants";

export const metadata = { title: "Discover creators" };

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pathway?: string; view?: string }>;
}) {
  const user = await requireStudent();
  const { q = "", pathway = "", view = "discover" } = await searchParams;
  const query = q.trim();
  const pathwayFilter = Object.keys(PATHWAYS).includes(pathway) ? pathway : "";

  const [creators, following, myPathway] = await Promise.all([
    searchCreators(user.id, query, { pathway: pathwayFilter || undefined }),
    view === "following" ? getFollowedCreators(user.id) : Promise.resolve([]),
    db.enrollment.findFirst({
      where: { userId: user.id, enrollmentType: "ELECTIVE" },
      select: { pathway: true },
    }),
  ]);

  const results = view === "following" ? following : creators;
  const myPathwayLabel = myPathway?.pathway
    ? PATHWAY_LABELS[myPathway.pathway as Pathway]
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Creators</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Discover creators</h1>
          <p className="mt-1 max-w-lg text-sm text-text-muted">
            Find other students by username or name, open their portfolio, and follow the
            work you like.
          </p>
        </div>
        {myPathwayLabel ? (
          <Badge tone="brand">Your pathway · {myPathwayLabel}</Badge>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/student/creators"
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
            view !== "following"
              ? "bg-brand-1 text-white"
              : "border border-border text-text-muted hover:text-text"
          }`}
        >
          <IconCompass className="h-4 w-4" /> Discover
        </Link>
        <Link
          href="/student/creators?view=following"
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
            view === "following"
              ? "bg-brand-1 text-white"
              : "border border-border text-text-muted hover:text-text"
          }`}
        >
          <IconUsers className="h-4 w-4" /> Following
        </Link>
      </div>

      <form method="get" className="flex flex-wrap gap-2">
        <input type="hidden" name="view" value={view} />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by username or name…"
          aria-label="Search creators"
          className="w-full max-w-sm rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus:border-brand-1 focus:outline-2 focus:outline-brand-3"
        />
        <select
          name="pathway"
          defaultValue={pathwayFilter}
          aria-label="Filter by pathway"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="">All pathways</option>
          {Object.entries(PATHWAY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-brand-1 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-2"
        >
          Search
        </button>
      </form>

      {results.length === 0 ? (
        <EmptyState
          title={view === "following" ? "You're not following anyone yet" : "No creators found"}
          body={
            view === "following"
              ? "Follow creators you discover and they'll show up here."
              : query
                ? "Try a different username or name."
                : "Creators will appear here as students complete their account setup."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((creator) => (
            <Card key={creator.id} className="flex flex-col p-5">
              <div className="flex items-start gap-3">
                <Avatar documentId={creator.avatarDocumentId} name={creator.fullName} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/student/creators/${creator.username ?? creator.id}`}
                    className="block truncate text-sm font-semibold hover:text-brand-1 dark:hover:text-brand-3"
                  >
                    {creator.fullName}
                  </Link>
                  {creator.username ? (
                    <p className="truncate text-xs text-text-muted">@{creator.username}</p>
                  ) : null}
                </div>
              </div>

              {creator.headline ? (
                <p className="mt-3 flex-1 text-sm text-text-muted">{creator.headline}</p>
              ) : (
                <p className="mt-3 flex-1 text-sm text-text-muted opacity-60">
                  No headline yet.
                </p>
              )}

              {creator.pathwayLabel ? (
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-text-muted">
                  {creator.pathwayLabel}
                </p>
              ) : null}

              <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
                <span className="inline-flex items-center gap-1">
                  <IconCourses className="h-3.5 w-3.5" />
                  {creator.projectCount} project{creator.projectCount === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <IconUsers className="h-3.5 w-3.5" />
                  {creator.followerCount} follower{creator.followerCount === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-4">
                {creator.id === user.id ? (
                  <Link
                    href="/student/profile"
                    className="text-xs font-semibold text-brand-1 hover:underline dark:text-brand-3"
                  >
                    This is you — edit your profile
                  </Link>
                ) : (
                  <FollowButton userId={creator.id} initialFollowing={creator.isFollowing} size="sm" />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
