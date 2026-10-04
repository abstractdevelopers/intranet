import { db } from "./db";
import { notify } from "./audit";

/** Public visibility: only PUBLISHED projects appear on a creator profile. */
export const PUBLIC_PROJECT_VISIBILITY = "PUBLISHED";

/**
 * Turn a submission into a portfolio piece. Idempotent — project.submissionId is
 * unique, so re-grading never duplicates.
 *
 * Called for every submission, not only passing ones, so a student's work is
 * never invisible while marking is pending. New pieces start HIDDEN; the
 * grading route promotes a passing grade to PUBLISHED, and the student can
 * publish anything themselves from /student/projects.
 *
 * `initialVisibility` lets a caller override that starting point.
 */
export async function publishProjectFromSubmission(
  submissionId: string,
  userId: string,
  initialVisibility: string = "HIDDEN"
) {
  const submission = await db.assignmentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: {
        include: {
          module: { include: { course: { select: { id: true, name: true } } } },
        },
      },
      files: { select: { documentId: true, fileName: true } },
    },
  });
  if (!submission) return null;

  const { assignment } = submission;
  const course = assignment.module.course;

  // One piece per assignment. A later attempt refreshes the same piece rather
  // than adding a second one, so a student who resubmits doesn't accumulate
  // near-identical entries.
  const existing = await db.project.findFirst({
    where: { userId, assignmentId: assignment.id },
    select: { id: true, visibility: true },
  });

  if (existing) {
    // Only refresh a draft. Once a piece is PUBLISHED (or RESTRICTED by staff)
    // it is the student's curated entry, so a new attempt updates the work
    // behind it but must not overwrite their edits or visibility.
    if (existing.visibility !== "HIDDEN") {
      await db.project.update({
        where: { id: existing.id },
        data: {
          submissionId: submission.id,
          externalUrl: submission.externalUrl ?? null,
          repoUrl: submission.repoUrl ?? null,
        },
      });
      return db.project.findUnique({ where: { id: existing.id } });
    }
    await db.project.update({
      where: { id: existing.id },
      data: {
        submissionId: submission.id,
        summary: assignment.description.slice(0, 400),
        description: submission.textContent ?? null,
        externalUrl: submission.externalUrl ?? null,
        repoUrl: submission.repoUrl ?? null,
        completedAt: submission.submittedAt,
        assets: {
          deleteMany: {},
          create: submission.files.map((f) => ({
            title: f.fileName,
            type: "FILE",
            documentId: f.documentId,
          })),
        },
      },
    });
    return db.project.findUnique({ where: { id: existing.id } });
  }

  const project = await db.project.create({
    data: {
      userId,
      courseId: course.id,
      submissionId: submission.id,
      assignmentId: assignment.id,
      title: assignment.title,
      summary: assignment.description.slice(0, 400),
      description: submission.textContent ?? null,
      externalUrl: submission.externalUrl ?? null,
      repoUrl: submission.repoUrl ?? null,
      visibility: initialVisibility,
      completedAt: submission.submittedAt,
      assets: {
        create: submission.files.map((f) => ({
          title: f.fileName,
          type: "FILE",
          documentId: f.documentId,
        })),
      },
    },
  });

  await notify({
    userId,
    type: "PROJECT_ADDED",
    title: `Added to your portfolio: ${assignment.title}`,
    body: `Your work from ${course.name} is now in your portfolio. You can edit, publish or hide it any time.`,
  });

  return project;
}

export type CreatorProfile = {
  id: string;
  username: string | null;
  fullName: string;
  headline: string | null;
  bio: string | null;
  avatarDocumentId: string | null;
  pathway: string | null;
  pathwayLabel: string | null;
  followerCount: number;
  followingCount: number;
  projectCount: number;
  likeCount: number;
};

/** True when the viewer may see this user's creator profile. */
export async function canViewCreator(viewerId: string, targetId: string) {
  if (viewerId === targetId) return true;
  const viewer = await db.user.findUnique({
    where: { id: viewerId },
    select: { role: true, status: true },
  });
  if (viewer?.role !== "STUDENT") return true; // staff can review any profile
  const target = await db.user.findFirst({
    where: { id: targetId, role: "STUDENT", status: "ACTIVE", onboardingCompletedAt: { not: null } },
    select: { id: true },
  });
  return Boolean(target);
}
