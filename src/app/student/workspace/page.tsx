import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { IconWorkspace, IconArrowRight } from "@/components/icons";
import { ProvisionWorkspaceButton } from "@/components/provision-workspace-button";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Workspace" };

export default async function WorkspacePage() {
  const user = await requireStudent();
  const workspaces = await db.workspace.findMany({
    where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Distinct product area — the Sandbox inside the academy */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-ink p-6 text-[#f6f1f8] md:p-8 dark:bg-surface-2">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(230,169,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(230,169,255,.6) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-1/40 ring-1 ring-inset ring-brand-3/30">
              <IconWorkspace className="h-6 w-6 text-brand-3" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-3">
                UCA Sandbox · Workspace
              </p>
              <h1 className="mt-0.5 text-2xl font-bold tracking-tight">Where you build</h1>
            </div>
          </div>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/70">
            The Workspace is your cloud-based building environment inside the academy — files,
            projects, code and a terminal, tied directly to your courses and assignments.
            Learning happens in the academy. Building happens here.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-brand-3/25 bg-brand-1/20 px-3 py-2 font-mono text-xs text-brand-3">
            <span className="text-white/50">$</span> uca workspace status
            <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse bg-brand-3" aria-hidden />
          </div>
        </div>
      </section>

      {workspaces.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            title="No workspace yet"
            body="Provision your workspace to get a cloud environment for your course projects, files and code."
          />
          <ProvisionWorkspaceButton />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {workspaces.map((w) => (
            <div key={w.id} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-1/10 text-brand-1 dark:text-brand-3">
                    <IconWorkspace className="h-4.5 w-4.5" />
                  </span>
                  <h2 className="text-base font-semibold">{w.name}</h2>
                </div>
                <Badge tone={statusTone(w.status)}>{w.status.toLowerCase()}</Badge>
              </div>
              <dl className="mt-3 space-y-1 text-xs text-text-muted">
                <div className="flex items-center gap-1">
                  <dt>Provider:</dt>
                  <dd className="flex items-center gap-1 font-medium">
                    {w.provider.toLowerCase()} <IconArrowRight className="h-3 w-3" />
                  </dd>
                </div>
                <div><dt className="inline">Provisioned:</dt> <dd className="inline font-medium">{formatDate(w.createdAt)}</dd></div>
                {w.externalId ? (
                  <div><dt className="inline">Environment ID:</dt> <dd className="inline font-mono font-medium">{w.externalId}</dd></div>
                ) : null}
              </dl>
              {w.url ? (
                <a
                  href={w.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-1 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-2"
                >
                  Open environment <IconArrowRight className="h-4 w-4" />
                </a>
              ) : (
                <p className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-3 text-xs text-text-muted">
                  Files, projects and the terminal boot here. This environment is ready — project
                  tooling comes online with the next infrastructure update.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
