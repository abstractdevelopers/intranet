import { db } from "./db";
import { notify } from "./audit";

/** Public visibility: only PUBLISHED projects appear on a creator profile. */
export const PUBLIC_PROJECT_VISIBILITY = "PUBLISHED";

/**
 * Turn a passed submission into a portfolio piece the first time it is graded.
 * Idempotent — project.submissionId is unique, so re-grading never duplicates.
 */
export async function publishProjectFromSubmission(submissionId: string, userId: string) {
  const existing = await db.project.findUnique({ where: { submissionId } });
  if (existing) return existing;

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

  const project = await db.project.create({
    data: {
      userId,
      courseId: course.id,
      submissionId: submission.id,
      title: assignment.title,
      summary: assignment.description.slice(0, 400),
      description: submission.textContent ?? null,
      externalUrl: submission.externalUrl ?? null,
      repoUrl: submission.repoUrl ?? null,
      visibility: PUBLIC_PROJECT_VISIBILITY,
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
    body: `Your graded work from ${course.name} is now on your creator profile. You can edit or hide it any time.`,
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
