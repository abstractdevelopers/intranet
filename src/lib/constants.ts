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
