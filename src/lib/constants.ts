export const ROLES = {
  FOUNDER: "FOUNDER",
  SUPER_ADMIN: "SUPER_ADMIN",
  ACADEMY_ADMIN: "ACADEMY_ADMIN",
  INSTRUCTOR: "INSTRUCTOR",
  REVIEWER: "REVIEWER",
  STUDENT: "STUDENT",
} as const;

export type Role = keyof typeof ROLES;

/** Roles with academy administration access. */
export const STAFF_ROLES: Role[] = [
  "FOUNDER",
  "SUPER_ADMIN",
  "ACADEMY_ADMIN",
  "INSTRUCTOR",
  "REVIEWER",
];

/** Roles allowed to review/approve applications and enrollments. */
export const APPLICATION_REVIEWER_ROLES: Role[] = [
  "FOUNDER",
  "SUPER_ADMIN",
  "ACADEMY_ADMIN",
];

export const ENROLLMENT_STATUS = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  SUSPENDED: "SUSPENDED",
  COMPLETED: "COMPLETED",
} as const;

export const APPLICATION_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export const OCCUPATIONS = [
  { value: "STUDENT", label: "Student" },
  { value: "EMPLOYED", label: "Employed" },
  { value: "ENTREPRENEUR", label: "Entrepreneur" },
  { value: "FREELANCER", label: "Freelancer" },
  { value: "JOB_SEEKER", label: "Job seeker" },
  { value: "OTHER", label: "Other" },
] as const;

export const EXPERIENCE_LEVELS = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
] as const;

/** Length of the free first month in days. */
export const TRIAL_DAYS = 30;

export const CURRENCY = "NGN";

/**
 * Pathways (#14). The two compulsory foundations plus exactly one elective.
 * `pathway` on Course/Enrollment uses these values.
 */
export const PATHWAYS = {
  GRAPHIC_DESIGN: "GRAPHIC_DESIGN",
  VIDEO_EDITING: "VIDEO_EDITING",
  COMMUNICATION_INFLUENCE: "COMMUNICATION_INFLUENCE",
  CONTENT_WRITING: "CONTENT_WRITING",
} as const;

export type Pathway = keyof typeof PATHWAYS;

/** Maps each elective course slug to the pathway it represents. */
export const ELECTIVE_SLUG_TO_PATHWAY: Record<string, Pathway> = {
  "graphics-design": "GRAPHIC_DESIGN",
  "video-editing": "VIDEO_EDITING",
  "communication-influence": "COMMUNICATION_INFLUENCE",
  "content-writing": "CONTENT_WRITING",
};

export const PATHWAY_LABELS: Record<Pathway, string> = {
  GRAPHIC_DESIGN: "Graphics Design",
  VIDEO_EDITING: "Video Editing",
  COMMUNICATION_INFLUENCE: "Communication & Influence",
  CONTENT_WRITING: "Content Writing",
};

export function pathwayFromSlug(slug: string): Pathway | null {
  return ELECTIVE_SLUG_TO_PATHWAY[slug] ?? null;
}

/**
 * Captain's Log questions (#12). Order matters — it is the order students see.
 */
export const CAPTAIN_LOG_QUESTIONS = [
  { id: "experience", label: "How was this week's learning experience?", multiline: true },
  { id: "learned", label: "What did you learn?", multiline: true },
  { id: "helpedBy", label: "Who helped you during this week?", multiline: false },
  { id: "helpedWho", label: "Who did you help during this week?", multiline: false },
  { id: "enjoyed", label: "What did you enjoy?", multiline: true },
  { id: "struggled", label: "What did you struggle with?", multiline: true },
  { id: "improve", label: "What can UCA improve?", multiline: true },
  { id: "anythingElse", label: "Is there anything else you want us to know?", multiline: true },
] as const;

export const CAPTAIN_LOG_STATUS = {
  SUBMITTED: "SUBMITTED",
  REVIEWED: "REVIEWED",
} as const;

export const PROJECT_VISIBILITY = {
  PUBLISHED: "PUBLISHED",
  HIDDEN: "HIDDEN",
  RESTRICTED: "RESTRICTED",
} as const;

export const SUBMISSION_STATUS = {
  SUBMITTED: "SUBMITTED",
  AWAITING_GRADING: "AWAITING_GRADING",
  GRADED: "GRADED",
  NEEDS_REVISION: "NEEDS_REVISION",
  RESUBMITTED: "RESUBMITTED",
} as const;
