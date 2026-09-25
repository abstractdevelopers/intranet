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

/**
 * The on-platform discussion feed. Built and tested, but locked off for now:
 * the academy is using the existing WhatsApp communities instead, so the feed
 * has no nav entry and its pages and APIs are closed. Flip this to true to
 * bring it back — no other change is needed.
 */
export const DISCUSSION_FEED_ENABLED = false;

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

/** The course slug for a pathway — used to draw the right course mark. */
export const PATHWAY_TO_SLUG: Record<Pathway, string> = {
  GRAPHIC_DESIGN: "graphics-design",
  VIDEO_EDITING: "video-editing",
  COMMUNICATION_INFLUENCE: "communication-influence",
  CONTENT_WRITING: "content-writing",
};

/**
 * Verification badges. GOLD marks the founding team; BLUE marks every other
 * signed-up account. Null on User.verificationTier means no badge.
 */
export const VERIFICATION_TIERS = {
  GOLD: "GOLD",
  BLUE: "BLUE",
} as const;

export type VerificationTier = keyof typeof VERIFICATION_TIERS;

/** Accounts that carry the gold badge. Every other verified account is blue. */
export const GOLD_VERIFIED_EMAILS = [
  "wallace@launchverse.space",
  "zaheer@launchverse.space",
  "ufolayca@gmail.com",
  "calebwallace127@gmail.com",
  "zaheercoderlts@gmail.com",
];

export function tierForEmail(email: string): VerificationTier {
  return GOLD_VERIFIED_EMAILS.includes(email.toLowerCase()) ? "GOLD" : "BLUE";
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

// ---------------------------------------------------------------------------
// Reclaim pathway auto-approval
// ---------------------------------------------------------------------------

/**
 * While rebuilding accounts after the 2026-09-25 incident, every returning
 * creator picks a pathway and is enrolled immediately instead of waiting for
 * staff review — there are ~685 of them and manual approval is not practical.
 *
 * This is a deliberately time-boxed allowance: it lapses at the end of
 * 2026-10-01, after which the normal "staff approve the elective" rule applies
 * again (and the legacy full application form is used instead of the
 * one-click picker). Nothing else needs changing when the date passes.
 */
export const PATHWAY_AUTO_APPROVAL_UNTIL = new Date("2026-10-01T23:59:59.999Z");

export function isPathwayAutoApprovalActive(now: Date = new Date()) {
  return now.getTime() <= PATHWAY_AUTO_APPROVAL_UNTIL.getTime();
}

/**
 * Number of returning creators who receive the Elite badge. Granted in the
 * order they complete their reclaim, and never again afterwards — the scarcity
 * is the point, so this is a hard ceiling rather than a threshold.
 */
export const ELITE_BADGE_LIMIT = 100;

// ---------------------------------------------------------------------------
// Pre-class window (course warm-up)
// ---------------------------------------------------------------------------

/**
 * Classes begin 5 October 2026. The warm-up is the small pre-class task that
 * gets each student thinking about their craft: one line about what they want
 * to make, visible to their coursemates. Writing closes at the end of
 * 3 October; the lines stay readable afterwards as an archive.
 */
export const CLASSES_START = new Date("2026-10-05T00:00:00.000Z");
export const PROMISE_WALL_CLOSES = new Date("2026-10-03T23:59:59.999Z");

export function isPromiseWallOpen(now: Date = new Date()) {
  return now.getTime() <= PROMISE_WALL_CLOSES.getTime();
}

/** Peer Body round lifecycle. */
export const PEER_BODY_STATUS = {
  REVIEWING: "REVIEWING",
  CLOSED: "CLOSED",
} as const;

/** Kindness-forward review prompts, shared by the form and the email. */
export const PEER_BODY_PROMPTS = {
  whatLanded: "What landed for you?",
  oneSuggestion: "One thing they could try next.",
  oneQuestion: "A question to leave them thinking.",
} as const;

// ---------------------------------------------------------------------------
// Warm-up — the pre-class course task
// ---------------------------------------------------------------------------

/**
 * One line each creator writes before classes begin: a small, real first
 * thought for their craft. Picked from a short list so the wall stays scannable
 * and every entry maps to something the academy actually teaches.
 */
export const PROMISE_GOALS = {
  PORTFOLIO: "Build a portfolio I'm proud of",
  AUDIENCE: "Grow a real audience",
  CLIENT: "Land my first client",
  SERIES: "Ship a series I love",
  PERSONAL_BRAND: "Build my personal brand",
} as const;

export type PromiseGoal = keyof typeof PROMISE_GOALS;

export const PROMISE_GOAL_KEYS = Object.keys(PROMISE_GOALS) as PromiseGoal[];

/**
 * A warm-up prompt written for each craft, so the exercise reads like a real
 * first task for that course rather than a generic form.
 */
export const PROMISE_PROMPTS_BY_PATHWAY: Record<Pathway, string[]> = {
  GRAPHIC_DESIGN: [
    "The brand I'd love to design is…",
    "The mark I'd sketch first is…",
    "The poster I'd want people to stop for is…",
  ],
  VIDEO_EDITING: [
    "The video I'd cut first is…",
    "The story I'd want to tell on screen is…",
    "The scene I'd love to edit is…",
  ],
  CONTENT_WRITING: [
    "The first line I'd write is…",
    "The story I'd publish first is…",
    "The piece I'd want people to quote is…",
  ],
  COMMUNICATION_INFLUENCE: [
    "The idea I'd want people to believe is…",
    "The message I'd want to be known for is…",
    "The conversation I'd want to start is…",
  ],
};

/** Used before a pathway is known, or when one isn't set. */
export const PROMISE_PROMPTS = [
  "What I want to build at UCA is…",
  "The first thing I want to make here is…",
  "I'm here because…",
] as const;

/**
 * The Studio Wall — one card per craft.
 *
 * The academy's premise is that a creator walks out with work, not notes. So the
 * wall is built around what each course actually produces: a craft, the medium
 * its students work in, the deliverable they are aiming at, and the promise
 * they make to get there. This is what ties the wall to the curriculum instead
 * of being a generic social feed.
 */
export const STUDIO_CRAFT: Record<
  Pathway,
  {
    /** What the course produces. */
    craft: string;
    /** The raw material — how students talk about their own work. */
    medium: string;
    /** Suggested deliverables for the ambition field. */
    deliverables: string[];
    /** Editorial blurb shown on the craft card. */
    ethos: string;
  }
> = {
  GRAPHIC_DESIGN: {
    craft: "Visual identity",
    medium: "Brand, type, colour",
    deliverables: ["A logo suite", "A brand book", "A poster series", "A packaging set"],
    ethos: "Designers don't decorate. They decide what a brand means, then make it impossible to ignore.",
  },
  VIDEO_EDITING: {
    craft: "Story on screen",
    medium: "Cut, pace, sound",
    deliverables: ["A 60-second film", "A reel", "A title sequence", "A mini-documentary"],
    ethos: "An edit is an argument. Every cut either earns the next second or loses it.",
  },
  CONTENT_WRITING: {
    craft: "Words that move",
    medium: "Voice, structure, truth",
    deliverables: ["A published essay", "A newsletter issue", "A long-form feature", "A campaign script"],
    ethos: "Writing is thinking made visible. The first draft is you finding out what you meant.",
  },
  COMMUNICATION_INFLUENCE: {
    craft: "Presence and persuasion",
    medium: "Voice, story, room",
    deliverables: ["A keynote", "A pitch deck", "A campaign idea", "A public talk"],
    ethos: "Influence isn't volume. It's the clarity to be believed, and the nerve to say it plainly.",
  },
};

/**
 * The creative brief each craft answers on the wall — the same shape for all
 * four so they are comparable, but worded in each discipline's own language.
 */
export const STUDIO_BRIEF: Record<Pathway, { promise: string; ambition: string }> = {
  GRAPHIC_DESIGN: {
    promise: "The brand I'd love to design is…",
    ambition: "By the end of term, I'll have made…",
  },
  VIDEO_EDITING: {
    promise: "The story I'd love to put on screen is…",
    ambition: "By the end of term, I'll have made…",
  },
  CONTENT_WRITING: {
    promise: "The piece I'd love to publish is…",
    ambition: "By the end of term, I'll have made…",
  },
  COMMUNICATION_INFLUENCE: {
    promise: "The idea I'd love people to believe is…",
    ambition: "By the end of term, I'll have made…",
  },
};

/** Craft chip colours, kept in step with the course marks. */
export const PATHWAY_TONES: Record<Pathway, string> = {
  GRAPHIC_DESIGN: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300",
  VIDEO_EDITING: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  COMMUNICATION_INFLUENCE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  CONTENT_WRITING: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};
