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

  // A student can hold more than one elective (the testing course counts as
  // one), so the pathway comes from the most recent accepted elective that
  // actually maps to a pathway. Taking the first elective instead would let a
  // pathway-less course mask the real one.
  const pathwayOf = (e: (typeof electives)[number]): Pathway | null =>
    (e.pathway as Pathway | null) ??
    (e.course.pathway as Pathway | null) ??
    pathwayFromSlug(e.course.slug);

  const pathwayEnrollment =
    [...electives].reverse().find((e) => e.status === "ACCEPTED" && pathwayOf(e)) ??
    electives[electives.length - 1] ??
    null;

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
 * Communities (#15) the student belongs to: the general UCA community (no
 * pathway) plus the community for their pathway. Inactive communities and
 * communities for other pathways are never returned.
 */
export async function getStudentCommunities(userId: string) {
  const { pathway } = await getStudentPathway(userId);

  return db.community.findMany({
    where: {
      isActive: true,
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
