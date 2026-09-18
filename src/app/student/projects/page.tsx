import Link from "next/link";
import { requireStudent } from "@/lib/rbac";
import { EmptyState } from "@/components/ui/empty";
import { ButtonLink } from "@/components/ui/button";
import { ProjectCard } from "@/components/creators/project-card";
import { db } from "@/lib/db";

export const metadata = { title: "My Portfolio" };

export default async function MyProjectsPage() {
  const user = await requireStudent();

  const projects = await db.project.findMany({
    where: { userId: user.id },
    include: {
      course: { select: { name: true } },
      _count: { select: { likes: true } },
    },
    orderBy: [{ featured: "desc" }, { completedAt: "desc" }],
  });

  const published = projects.filter((p) => p.visibility === "PUBLISHED").length;
  const totalLikes = projects.reduce((sum, p) => sum + p._count.likes, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">My Portfolio</h1>
          <p className="mt-1 max-w-xl text-sm text-text-muted">
            Graded work is added to your portfolio automatically. Curate it here — feature
            your best pieces, or hide ones you&rsquo;d rather not show.
          </p>
        </div>
        {user.username ? (
          <ButtonLink href={`/student/creators/${user.username}`} variant="secondary">
            View public profile
          </ButtonLink>
        ) : null}
      </header>

      {projects.length > 0 ? (
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-text-muted">
            <span className="font-semibold text-text">{projects.length}</span> projects
          </span>
          <span className="text-text-muted">
            <span className="font-semibold text-text">{published}</span> published
          </span>
          <span className="text-text-muted">
            <span className="font-semibold text-text">{totalLikes}</span> likes received
          </span>
        </div>
      ) : null}

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          body="When an assignment you submit is graded and passed, it lands here and on your creator profile."
          action={<ButtonLink href="/student/assignments">See your assignments</ButtonLink>}
        />
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={{
                id: p.id,
                title: p.title,
                summary: p.summary,
                description: p.description,
                visibility: p.visibility,
                featured: p.featured,
                restrictedReason: p.restrictedReason,
                courseName: p.course?.name ?? null,
                externalUrl: p.externalUrl,
                repoUrl: p.repoUrl,
                likeCount: p._count.likes,
              }}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-text-muted">
        Looking for other students&rsquo; work?{" "}
        <Link href="/student/creators" className="underline-offset-2 hover:underline">
          Discover creators
        </Link>
        .
      </p>
    </div>
  );
}
