import Link from "next/link";
import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { CreatorCard } from "@/components/creators/creator-card";
import { IconCompass, IconUsers } from "@/components/icons";
import { searchCreators, getFollowedCreators, getFollowers } from "@/lib/creators";
import { PATHWAY_LABELS, PATHWAYS, type Pathway } from "@/lib/constants";

export const metadata = { title: "Discover creators" };

type View = "discover" | "following" | "followers";

const TABS: { value: View; label: string; icon: typeof IconCompass }[] = [
  { value: "discover", label: "Discover", icon: IconCompass },
  { value: "following", label: "Following", icon: IconUsers },
  { value: "followers", label: "Followers", icon: IconUsers },
];

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pathway?: string; view?: string }>;
}) {
  const user = await requireStudent();
  const { q = "", pathway = "", view = "discover" } = await searchParams;
  const query = q.trim();
  const pathwayFilter = Object.keys(PATHWAYS).includes(pathway) ? pathway : "";
  const activeView: View =
    view === "following" ? "following" : view === "followers" ? "followers" : "discover";

  const [creators, following, followers, myPathway, counts] = await Promise.all([
    activeView === "discover"
      ? searchCreators(user.id, query, { pathway: pathwayFilter || undefined })
      : Promise.resolve([]),
    activeView === "following" ? getFollowedCreators(user.id) : Promise.resolve([]),
    activeView === "followers" ? getFollowers(user.id) : Promise.resolve([]),
    db.enrollment.findFirst({
      where: { userId: user.id, enrollmentType: "ELECTIVE" },
      select: { pathway: true },
    }),
    db.user.findUnique({
      where: { id: user.id },
      select: { _count: { select: { followers: true, following: true } } },
    }),
  ]);

  const results =
    activeView === "following" ? following : activeView === "followers" ? followers : creators;
  const myPathwayLabel = myPathway?.pathway
    ? PATHWAY_LABELS[myPathway.pathway as Pathway]
    : null;

  const emptyCopy: Record<View, { title: string; body: string }> = {
    discover: {
      title: "No creators found",
      body: query
        ? "Try a different username or name."
        : "Creators will appear here as students complete their account setup.",
    },
    following: {
      title: "You're not following anyone yet",
      body: "Follow creators you discover and they'll show up here.",
    },
    followers: {
      title: "No followers yet",
      body: "Publish work to your portfolio and share your profile — followers will appear here.",
    },
  };

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
        {TABS.map((tab) => {
          const count =
            tab.value === "following"
              ? counts?._count.following
              : tab.value === "followers"
                ? counts?._count.followers
                : null;
          const TabIcon = tab.icon;
          return (
            <Link
              key={tab.value}
              href={
                tab.value === "discover"
                  ? "/student/creators"
                  : `/student/creators?view=${tab.value}`
              }
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                activeView === tab.value
                  ? "bg-brand-1 text-white"
                  : "border border-border text-text-muted hover:text-text"
              }`}
            >
              <TabIcon className="h-4 w-4" /> {tab.label}
              {count !== null ? <span className="opacity-75">{count}</span> : null}
            </Link>
          );
        })}
      </div>

      {activeView === "discover" ? (
        <form method="get" className="flex flex-wrap gap-2">
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
      ) : null}

      {results.length === 0 ? (
        <EmptyState title={emptyCopy[activeView].title} body={emptyCopy[activeView].body} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((creator) => (
            <CreatorCard key={creator.id} creator={creator} viewerId={user.id} />
          ))}
        </div>
      )}
    </div>
  );
}
