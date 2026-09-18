import Link from "next/link";
import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { ProjectControl } from "@/components/admin/project-control";
import { CourseMark } from "@/components/course-mark";
import { IconHeart, IconUsers } from "@/components/icons";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Projects" };

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireStaff();
  const { q = "", status = "" } = await searchParams;
  const query = q.trim();

  const projects = await db.project.findMany({
    where: {
      ...(status === "PUBLISHED" || status === "HIDDEN" || status === "RESTRICTED"
        ? { visibility: status }
        : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { user: { username: { contains: query, mode: "insensitive" } } },
              { user: { profile: { fullName: { contains: query, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    include: {
      course: { select: { name: true, slug: true } },
      user: { select: { id: true, username: true, profile: { select: { fullName: true } } } },
      _count: { select: { likes: true, assets: true } },
    },
    orderBy: [{ completedAt: "desc" }],
    take: 100,
  });

  const restrictedCount = projects.filter((p) => p.visibility === "RESTRICTED").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Creators</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Student projects</h1>
          <p className="mt-1 text-sm text-text-muted">
            Every portfolio piece on the intranet. Restrict anything that shouldn&rsquo;t be
            public.
          </p>
        </div>
        {restrictedCount > 0 ? <Badge tone="danger">{restrictedCount} restricted</Badge> : null}
      </header>

      <form method="get" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by title or student…"
          aria-label="Search projects"
          className="w-full max-w-sm rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus:border-brand-1 focus:outline-2 focus:outline-brand-3"
        />
        <select
          name="status"
          defaultValue={status}
          aria-label="Filter by visibility"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="">All visibilities</option>
          <option value="PUBLISHED">Published</option>
          <option value="HIDDEN">Hidden</option>
          <option value="RESTRICTED">Restricted</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-brand-1 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-2"
        >
          Filter
        </button>
      </form>

      {projects.length === 0 ? (
        <EmptyState
          title="No projects found"
          body={
            query || status
              ? "Try a different filter."
              : "Projects appear here once graded assignments are published to portfolios."
          }
        />
      ) : (
        <div className="space-y-3">
          {projects.map((p) => {
            const name = p.user.profile?.fullName ?? p.user.username ?? "Student";
            return (
              <Card key={p.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {p.course ? <CourseMark slug={p.course.slug} size="sm" /> : null}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold">{p.title}</h2>
                        <Badge
                          tone={
                            p.visibility === "RESTRICTED"
                              ? "danger"
                              : p.visibility === "HIDDEN"
                                ? "warning"
                                : "success"
                          }
                        >
                          {p.visibility.toLowerCase()}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {name}
                        {p.user.username ? ` · @${p.user.username}` : ""}
                        {p.course ? ` · ${p.course.name}` : ""} · {formatDate(p.completedAt)}
                      </p>
                      <p className="mt-2 max-w-2xl text-sm text-text-muted">{p.summary}</p>
                      {p.restrictedReason ? (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                          Restricted: {p.restrictedReason}
                        </p>
                      ) : null}
                      <div className="mt-2 flex items-center gap-4 text-xs text-text-muted">
                        <span className="inline-flex items-center gap-1">
                          <IconHeart className="h-3.5 w-3.5" /> {p._count.likes}
                        </span>
                        <span>{p._count.assets} attachments</span>
                        <Link
                          href={`/admin/students/${p.user.id}`}
                          className="font-semibold text-brand-1 hover:underline dark:text-brand-3"
                        >
                          View student
                        </Link>
                      </div>
                    </div>
                  </div>
                  <ProjectControl projectId={p.id} visibility={p.visibility} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-text-muted">
        <IconUsers className="h-3.5 w-3.5" />
        Restricting hides a project from the intranet without deleting it. Restoring returns it
        to the student&rsquo;s control.
      </p>
    </div>
  );
}