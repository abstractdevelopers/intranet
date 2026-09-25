import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { ButtonLink } from "@/components/ui/button";
import { CourseMark } from "@/components/course-mark";
import { Avatar } from "@/components/creators/avatar";
import { VerificationBadge } from "@/components/verification-badge";
import { EliteBadge } from "@/components/elite-badge";
import { FollowButton } from "@/components/creators/follow-button";
import { LikeButton } from "@/components/creators/like-button";
import { IconUsers, IconCourses, IconFile, IconClock } from "@/components/icons";
import { canViewCreator } from "@/lib/projects";
import { getCreatorProjects } from "@/lib/creators";
import { PATHWAY_LABELS, type Pathway } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const viewer = await requireStudent();

  // Resolve by username, falling back to id so links keep working if a student
  // changes their username.
  const creator = await db.user.findFirst({
    where: {
      role: "STUDENT",
      OR: [{ username }, { id: username }],
    },
    select: {
      id: true,
      username: true,
      status: true,
      verificationTier: true,
      eliteMemberNumber: true,
      onboardingCompletedAt: true,
      createdAt: true,
      profile: {
        select: {
          fullName: true,
          headline: true,
          bio: true,
          location: true,
          avatarDocumentId: true,
        },
      },
      enrollments: {
        where: { status: "ACCEPTED" },
        include: { course: { select: { id: true, name: true, slug: true, type: true, pathway: true } } },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { followers: true, following: true, projects: { where: { visibility: "PUBLISHED" } } } },
    },
  });
  if (!creator) notFound();
  if (!(await canViewCreator(viewer.id, creator.id))) notFound();

  const isSelf = creator.id === viewer.id;

  const [projects, isFollowing, followsYou] = await Promise.all([
    getCreatorProjects(creator.id, { includeHidden: isSelf }),
    isSelf
      ? Promise.resolve(false)
      : db.follow
          .findUnique({
            where: { followerId_followingId: { followerId: viewer.id, followingId: creator.id } },
            select: { id: true },
          })
          .then((f) => Boolean(f)),
    isSelf
      ? Promise.resolve(false)
      : db.follow
          .findUnique({
            where: { followerId_followingId: { followerId: creator.id, followingId: viewer.id } },
            select: { id: true },
          })
          .then((f) => Boolean(f)),
  ]);

  const likedProjectIds = isSelf
    ? []
    : (
        await db.projectLike.findMany({
          where: {
            userId: viewer.id,
            projectId: { in: projects.map((p) => p.id) },
          },
          select: { projectId: true },
        })
      ).map((l) => l.projectId);
  const likedSet = new Set(likedProjectIds);

  const elective = creator.enrollments.find((e) => e.course.type === "ELECTIVE") ?? null;
  const pathway = elective?.pathway ?? elective?.course.pathway ?? null;
  const pathwayLabel = pathway ? (PATHWAY_LABELS[pathway as Pathway] ?? pathway) : null;
  const featured = projects.filter((p) => p.featured);
  const rest = projects.filter((p) => !p.featured);
  const displayName = creator.profile?.fullName ?? "UCA student";

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Creator hero */}
      <section className="hero-band rounded-2xl p-6 md:p-8" aria-label="Creator profile">
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <Avatar documentId={creator.profile?.avatarDocumentId ?? null} name={displayName} size="lg" />
            <div className="min-w-0">
              <p className="hero-eyebrow text-[11px] font-semibold uppercase tracking-[0.18em]">
                Creator profile
              </p>
              <h1 className="mt-1.5 flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
                <span>{displayName}</span>
                <EliteBadge memberNumber={creator.eliteMemberNumber} className="h-5 w-5" />
                <VerificationBadge tier={creator.verificationTier} className="h-5 w-5" />
              </h1>
              {creator.username ? (
                <p className="hero-muted mt-1 text-sm">@{creator.username}</p>
              ) : null}
              {creator.profile?.headline ? (
                <p className="mt-2 max-w-md text-sm text-white/85">{creator.profile.headline}</p>
              ) : null}
              <div className="hero-muted mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <IconCourses className="h-3.5 w-3.5" />
                  {creator._count.projects} project{creator._count.projects === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <IconUsers className="h-3.5 w-3.5" />
                  {isSelf ? (
                    <>
                      <Link href="/student/creators?view=followers" className="hover:underline">
                        {creator._count.followers} follower{creator._count.followers === 1 ? "" : "s"}
                      </Link>
                      {" · "}
                      <Link href="/student/creators?view=following" className="hover:underline">
                        {creator._count.following} following
                      </Link>
                    </>
                  ) : (
                    <>
                      {creator._count.followers} follower{creator._count.followers === 1 ? "" : "s"} ·{" "}
                      {creator._count.following} following
                    </>
                  )}
                </span>
                {creator.profile?.location ? <span>{creator.profile.location}</span> : null}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            {isSelf ? (
              <ButtonLink href="/student/profile" variant="secondary">
                Edit profile
              </ButtonLink>
            ) : (
              <>
                <FollowButton
                  userId={creator.id}
                  initialFollowing={isFollowing}
                  followsYou={followsYou}
                />
                {!isFollowing && followsYou ? (
                  <span className="hero-muted text-xs">Follows you</span>
                ) : null}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Pathway + bio */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <p className="eyebrow">About</p>
          {creator.profile?.bio ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{creator.profile.bio}</p>
          ) : (
            <p className="mt-2 text-sm text-text-muted">No bio yet.</p>
          )}
          <p className="mt-4 text-xs text-text-muted">
            Student since {formatDate(creator.createdAt)}
          </p>
        </Card>
        <Card>
          <p className="eyebrow">Pathway</p>
          <p className="mt-2 text-sm font-semibold">{pathwayLabel ?? "Not chosen yet"}</p>
          <div className="mt-3 space-y-1.5">
            {creator.enrollments.map((e) => (
              <p key={e.id} className="text-xs text-text-muted">
                {e.course.name}
                <span className="ml-1 uppercase tracking-wide opacity-70">
                  · {e.enrollmentType.toLowerCase()}
                </span>
              </p>
            ))}
          </div>
        </Card>
      </section>

      {/* Portfolio */}
      <section aria-label="Portfolio">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow">Portfolio</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">
              {isSelf ? "Your completed projects" : "Completed projects"}
            </h2>
          </div>
          {isSelf ? (
            <Link
              href="/student/projects"
              className="text-sm font-medium text-brand-1 hover:text-brand-2 dark:text-brand-3"
            >
              Manage portfolio
            </Link>
          ) : null}
        </div>

        {projects.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title={isSelf ? "No projects yet" : "No projects published yet"}
              body={
                isSelf
                  ? "Graded assignments become portfolio pieces automatically."
                  : "When this creator completes graded work, it will appear here."
              }
            />
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {featured.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {featured.map((p) => (
                  <PortfolioCard
                    key={p.id}
                    project={p}
                    liked={likedSet.has(p.id)}
                    showVisibility={isSelf}
                  />
                ))}
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              {rest.map((p) => (
                <PortfolioCard
                  key={p.id}
                  project={p}
                  liked={likedSet.has(p.id)}
                  showVisibility={isSelf}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function PortfolioCard({
  project,
  liked,
  showVisibility,
}: {
  project: {
    id: string;
    title: string;
    summary: string;
    description: string | null;
    externalUrl: string | null;
    repoUrl: string | null;
    visibility: string;
    completedAt: Date;
    course: { name: string; slug: string } | null;
    assets: { id: string; title: string; type: string; url: string | null; documentId: string | null }[];
    _count: { likes: number };
  };
  liked: boolean;
  showVisibility: boolean;
}) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start gap-3">
        {project.course ? <CourseMark slug={project.course.slug} size="sm" /> : null}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{project.title}</h3>
          {project.course ? (
            <p className="mt-0.5 text-xs text-text-muted">{project.course.name}</p>
          ) : null}
        </div>
        {showVisibility && project.visibility !== "PUBLISHED" ? (
          <Badge tone={project.visibility === "RESTRICTED" ? "danger" : "warning"}>
            {project.visibility === "RESTRICTED" ? "restricted" : "hidden"}
          </Badge>
        ) : null}
      </div>

      <p className="mt-3 flex-1 text-sm text-text-muted">{project.summary}</p>

      {project.description ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-brand-1 dark:text-brand-3">
            Read more
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{project.description}</p>
        </details>
      ) : null}

      {project.assets.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {project.assets.map((a) => (
            <li key={a.id}>
              <a
                href={a.documentId ? `/api/documents/${a.documentId}` : (a.url ?? "#")}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-1 underline-offset-2 hover:underline dark:text-brand-3"
              >
                <IconFile className="h-3.5 w-3.5" />
                {a.title}
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {project.repoUrl || project.externalUrl ? (
        <p className="mt-3 truncate">
          <a
            href={project.repoUrl ?? project.externalUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-brand-1 underline-offset-2 hover:underline dark:text-brand-3"
          >
            {project.repoUrl ?? project.externalUrl}
          </a>
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <IconClock className="h-3.5 w-3.5" />
          {formatDate(project.completedAt)}
        </span>
        <LikeButton
          projectId={project.id}
          initialLiked={liked}
          initialCount={project._count.likes}
          size="sm"
        />
      </div>
    </Card>
  );
}
