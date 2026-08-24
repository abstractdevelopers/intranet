import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { IconWorkspace, IconArrowRight } from "@/components/icons";

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
        <EmptyState
          title="Your workspace is being prepared"
          body="Workspace provisioning is rolling out to students. Your projects, files and development environment will live here — connected to your courses when it arrives."
        />
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
              <p className="mt-2 flex items-center gap-1 text-sm text-text-muted">
                Provider: {w.provider} <IconArrowRight className="h-3.5 w-3.5" />
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
