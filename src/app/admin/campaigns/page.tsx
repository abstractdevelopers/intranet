import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { CampaignComposer } from "@/components/admin/campaign-composer";
import { CampaignRowActions } from "@/components/admin/campaign-row-actions";
import { formatDateTime } from "@/lib/format";
import { parseAudience, describeAudience } from "@/lib/campaign-sender";
import { CAMPAIGN_STYLES } from "@/lib/email-campaigns";

export const metadata = { title: "Email campaigns" };

export default async function AdminCampaignsPage() {
  await requireStaff();

  const [campaigns, courses] = await Promise.all([
    db.emailCampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        createdBy: { select: { email: true } },
        _count: { select: { recipients: true } },
      },
    }),
    db.course.findMany({
      where: { isActive: true },
      select: { id: true, name: true, type: true, pathway: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
  ]);

  // Delivery counts per campaign, so the list shows real progress at a glance.
  const counts = await db.emailCampaignRecipient.groupBy({
    by: ["campaignId", "status"],
    where: { campaignId: { in: campaigns.map((c) => c.id) } },
    _count: true,
  });
  const tally = new Map<string, { sent: number; failed: number; pending: number }>();
  for (const row of counts) {
    const entry = tally.get(row.campaignId) ?? { sent: 0, failed: 0, pending: 0 };
    if (row.status === "SENT") entry.sent += row._count;
    else if (row.status === "FAILED" || row.status === "SENDING") entry.failed += row._count;
    else entry.pending += row._count;
    tally.set(row.campaignId, entry);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Email campaigns</h1>
        <p className="mt-1 text-sm text-text-muted">
          Write once, choose an audience, and send now or schedule it. Every campaign carries an
          unsubscribe link and is delivered in the background.
        </p>
      </header>

      <Card className="p-6">
        <p className="eyebrow">New campaign</p>
        <div className="mt-4">
          <CampaignComposer courses={courses} styles={CAMPAIGN_STYLES} />
        </div>
      </Card>

      <section>
        <p className="eyebrow">Campaigns</p>
        {campaigns.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No campaigns yet" body="Campaigns you create will appear here." />
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {campaigns.map((c) => {
              const t = tally.get(c.id) ?? { sent: 0, failed: 0, pending: 0 };
              const total = c.audienceSize ?? c._count.recipients;
              return (
                <li key={c.id}>
                  <Card className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{c.title}</p>
                        <p className="mt-0.5 truncate text-sm text-text-muted">{c.subject}</p>
                        <p className="mt-2 text-xs text-text-muted">
                          {describeAudience(parseAudience(c.audience))} · {total} recipient
                          {total === 1 ? "" : "s"}
                          {c.status === "SCHEDULED" && c.scheduledAt
                            ? ` · scheduled ${formatDateTime(c.scheduledAt)}`
                            : ""}
                          {" · "}
                          {c.createdBy.email} · {formatDateTime(c.createdAt)}
                        </p>
                      </div>
                      <Badge tone={statusTone(c.status)}>{c.status.toLowerCase()}</Badge>
                    </div>

                    {c._count.recipients > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-text-muted">
                        <span>{t.sent} sent</span>
                        {t.failed > 0 ? <span className="text-red-600 dark:text-red-400">{t.failed} failed</span> : null}
                        {t.pending > 0 ? <span>{t.pending} pending</span> : null}
                      </div>
                    ) : null}

                    <div className="mt-4">
                      <CampaignRowActions
                        id={c.id}
                        status={c.status}
                        title={c.title}
                        sentCount={t.sent}
                      />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}