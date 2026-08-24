import { db } from "./db";

export type Milestone = {
  id: string;
  title: string;
  description: string;
  achieved: boolean;
  achievedAt?: Date | null;
};

/**
 * Compute a student's academy milestones from real data.
 * Never fabricate: a milestone is achieved only when the underlying record exists.
 */
export async function getMilestones(userId: string): Promise<Milestone[]> {
  const [enrollments, lessonDone, submissions, grades] = await Promise.all([
    db.enrollment.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.lessonProgress.count({ where: { userId, completedAt: { not: null } } }),
    db.assignmentSubmission.count({ where: { userId } }),
    db.grade.count({ where: { submission: { userId } } }),
  ]);

  const enrolled = enrollments.length > 0;
  const electiveApproved = enrollments.some(
    (e) => e.enrollmentType === "ELECTIVE" && e.status === "ACCEPTED"
  );
  const anyCompleted = enrollments.some((e) => e.status === "COMPLETED");

  return [
    {
      id: "enrolled",
      title: "Enrolled",
      description: "Joined the academy",
      achieved: enrolled,
      achievedAt: enrollments[0]?.createdAt ?? null,
    },
    {
      id: "program-complete",
      title: "Full Program",
      description: "Elective approved — three courses active",
      achieved: electiveApproved,
    },
    {
      id: "first-lesson",
      title: "First Lesson",
      description: "Completed your first lesson",
      achieved: lessonDone > 0,
    },
    {
      id: "first-submission",
      title: "First Submission",
      description: "Submitted your first assignment",
      achieved: submissions > 0,
    },
    {
      id: "first-grade",
      title: "First Grade",
      description: "Received your first review",
      achieved: grades > 0,
    },
    {
      id: "course-complete",
      title: "Course Complete",
      description: "Finished a full course",
      achieved: anyCompleted,
    },
  ];
}
