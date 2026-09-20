import { db } from "./db";
import { PATHWAY_LABELS, pathwayFromSlug, type Pathway } from "./constants";

export type StudentPathway = {
  pathway: Pathway | null;
  label: string | null;
  /** Compulsory foundations every student takes. */
  compulsory: { id: string; name: string; slug: string; status: string }[];
  /** The one approved elective that defines the pathway. */
  elective: { id: string; name: string; slug: string; status: string } | null;
};

/**
 * The student's pathway, derived from their accepted enrollment whose course
 * carries a pathway — falling back to their approved application's elective.
 * Never inferred from course name text.
 */
export async function getStudentPathway(userId: string): Promise<StudentPathway> {
  const enrollments = await db.enrollment.findMany({
    where: { userId },
    include: { course: { select: { id: true, name: true, slug: true, pathway: true } } },
    orderBy: { createdAt: "asc" },
  });

  const compulsory = enrollments
    .filter((e) => e.enrollmentType === "COMPULSORY")
    .map((e) => ({
      id: e.course.id,
      name: e.course.name,
      slug: e.course.slug,
      status: e.status,
    }));

  const electives = enrollments.filter((e) => e.enrollmentType === "ELECTIVE");

  const pathwayOf = (e: (typeof electives)[number]): Pathway | null =>
    (e.pathway as Pathway | null) ??
    (e.course.pathway as Pathway | null) ??
    pathwayFromSlug(e.course.slug);

  // Only an ACCEPTED elective defines a pathway. PENDING and REJECTED electives
  // grant nothing: a pending applicant has not been approved, and a rejected
  // one must stay out entirely. Falling back to any elective would leak that
  // pathway's resources (its community link) to students who don't have it.
  const pathwayEnrollment =
    [...electives].reverse().find((e) => e.status === "ACCEPTED" && pathwayOf(e)) ?? null;

  const elective = pathwayEnrollment
    ? {
        id: pathwayEnrollment.course.id,
        name: pathwayEnrollment.course.name,
        slug: pathwayEnrollment.course.slug,
        status: pathwayEnrollment.status,
      }
    : null;

  const pathway = pathwayEnrollment ? pathwayOf(pathwayEnrollment) : null;

  return {
    pathway: pathway ?? null,
    label: pathway ? PATHWAY_LABELS[pathway] : null,
    compulsory,
    elective,
  };
}

/**
 * Communities (#15) a student may see:
 *
 * - the general UCA community (pathway null), which every student gets;
 * - the community for the student's own pathway, and only that one.
 *
 * A student with no accepted elective has no pathway, so they see the general
 * community and nothing else. Communities for other pathways, and inactive
 * communities, are never returned — so a dept link can't reach a student who
 * didn't apply for that dept.
 */
export async function getStudentCommunities(userId: string) {
  const { pathway } = await getStudentPathway(userId);

  return db.community.findMany({
    where: {
      isActive: true,
      // General is unconditional; the pathway branch is added only when the
      // student actually has an approved pathway.
      OR: [{ pathway: null }, ...(pathway ? [{ pathway }] : [])],
    },
    orderBy: [{ pathway: "asc" }, { order: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      platform: true,
      url: true,
      pathway: true,
    },
  });
}
