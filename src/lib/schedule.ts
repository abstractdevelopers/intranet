/**
 * Course release scheduling.
 *
 * Content goes live at 10:00 WAT every release day. WAT is UTC+1 year-round
 * (Nigeria has no daylight saving), so 10:00 WAT is 09:00 UTC — and releaseAt is
 * stored in UTC, which is what the unlock checks compare against.
 *
 * The academy week has a fixed rhythm: lessons early in the week, assignments
 * midweek, submissions on Friday, Saturday free with the Captain's Log.
 */

/** WAT is UTC+1 all year — no DST to account for. */
export const WAT_OFFSET_HOURS = 1;

/** Every release lands at this hour, WAT. */
export const RELEASE_HOUR_WAT = 10;

/**
 * A Date for `date` ("YYYY-MM-DD") at `hour` WAT, expressed in UTC.
 *
 * `atWat("2026-10-05")` -> 2026-10-05T09:00:00.000Z, i.e. 10:00 in Lagos.
 */
export function atWat(date: string, hour: number = RELEASE_HOUR_WAT, minute = 0): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour - WAT_OFFSET_HOURS, minute, 0, 0));
}

/** Render a UTC instant as a WAT clock label, e.g. "Mon 5 Oct, 10:00 WAT". */
export function watLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date) + " WAT";
}

/**
 * The weekly rhythm, as the academy runs it. `releaseContent` marks days on
 * which new material goes live at 10:00 WAT.
 */
export const WEEKLY_RHYTHM = [
  { day: "MONDAY", focus: "Courses, modules and lessons", releaseContent: true },
  { day: "TUESDAY", focus: "Courses, modules and lessons", releaseContent: true },
  { day: "WEDNESDAY", focus: "Assignments", releaseContent: true },
  { day: "THURSDAY", focus: "Assignments", releaseContent: true },
  { day: "FRIDAY", focus: "Assignment submissions", releaseContent: true },
  { day: "SATURDAY", focus: "Free day and Captain's Log", releaseContent: false },
  { day: "SUNDAY", focus: "Rest and catch-up", releaseContent: false },
] as const;

/**
 * A module covers two weeks of content, and each week carries its own Captain's
 * Log. Because `Module.weekNumber` and the Captain's Log gate are both per-week,
 * one Module row represents ONE week; a two-week "module" is two rows.
 *
 * Returns the week numbers belonging to a module number (1-based).
 *   moduleWeeks(1) -> [1, 2]
 *   moduleWeeks(2) -> [3, 4]
 */
export function moduleWeeks(moduleNumber: number): [number, number] {
  const first = moduleNumber * 2 - 1;
  return [first, first + 1];
}

/** The module number a week belongs to. Week 3 -> module 2. */
export function moduleForWeek(weekNumber: number): number {
  return Math.ceil(weekNumber / 2);
}
