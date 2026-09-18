import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { CommunityForm } from "@/components/admin/community-form";
import { CommunityList } from "@/components/admin/community-list";
import { PATHWAY_LABELS } from "@/lib/constants";

export const metadata = { title: "Communities" };

export default async function AdminCommunitiesPage() {
  await requireStaff();

  const communities = await db.community.findMany({
    orderBy: [{ pathway: "asc" }, { order: "asc" }, { name: "asc" }],
  });

  const pathwayOptions = Object.entries(PATHWAY_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const general = communities.filter((c) => !c.pathway);
  const byPathway = pathwayOptions
    .map((p) => ({
      ...p,
      communities: communities.filter((c) => c.pathway === p.value),
    }))
    .filter((p) => p.communities.length > 0);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <p className="eyebrow">Communities</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Community links</h1>
        <p className="mt-1 max-w-xl text-sm text-text-muted">
          Students see the general community plus the links for their own pathway — nothing
          else.
        </p>
      </header>

      <section>
        <p className="eyebrow">01 — Add a community</p>
        <Card className="mt-4 p-6">
          <CommunityForm pathways={pathwayOptions} />
        </Card>
      </section>

      <section>
        <p className="eyebrow">02 — Current links</p>
        {communities.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No communities yet"
              body="Add the general UCA community and one per pathway so students always have somewhere to go."
            />
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            <div>
              <h2 className="text-sm font-semibold">
                General <Badge tone="neutral">everyone</Badge>
              </h2>
              <div className="mt-3">
                {general.length === 0 ? (
                  <p className="text-sm text-text-muted">No general community set yet.</p>
                ) : (
                  <CommunityList communities={general} />
                )}
              </div>
            </div>

            {byPathway.map((group) => (
              <div key={group.value}>
                <h2 className="text-sm font-semibold">{group.label}</h2>
                <div className="mt-3">
                  <CommunityList communities={group.communities} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}