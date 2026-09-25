import { IconCheckCircle, IconMedal, IconCourses, IconCalendar } from "@/components/icons";
import { ELITE_BADGE_LIMIT } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { CLASSES_START } from "@/lib/constants";

/**
 * What's waiting for a returning creator, shown during account reclaim so they
 * know the upside before they finish setting up.
 *
 * Deliberately a plain list of things they actually get — not points, badges
 * for showing up, or urgency tricks. The only live number is how many Elite
 * places are left, and even that is stated once.
 */
export function ReclaimPerks({ eliteRemaining }: { eliteRemaining?: number }) {
  const eliteGone = typeof eliteRemaining === "number" && eliteRemaining <= 0;

  const perks: { icon: React.ReactNode; title: string; body: string }[] = [
    {
      icon: <IconCalendar className="h-4 w-4" />,
      title: "Your free month restarts",
      body: "30 days on us from the day you return — nothing to pay while you settle in.",
    },
    {
      icon: <IconMedal className="h-4 w-4" />,
      title: eliteGone ? "Elite Member status — claimed" : "Elite Member status",
      body: eliteGone
        ? `All ${ELITE_BADGE_LIMIT} founding places have been claimed. Your account is still restored in full.`
        : typeof eliteRemaining === "number"
          ? `The first ${ELITE_BADGE_LIMIT} creators back get a permanent numbered badge on their profile. ${eliteRemaining} place${eliteRemaining === 1 ? "" : "s"} left.`
          : `The first ${ELITE_BADGE_LIMIT} creators back get a permanent numbered badge on their profile.`,
    },
    {
      icon: <IconCourses className="h-4 w-4" />,
      title: "Start on your pathway",
      body: "Choose your elective and begin — no waiting on approval during the window.",
    },
    {
      icon: <IconCalendar className="h-4 w-4" />,
      title: `Settled in before ${formatDate(CLASSES_START)}`,
      body: "Classes begin that day, so finishing setup now means you start on day one.",
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="eyebrow text-xs font-semibold">What&apos;s waiting for you</p>
      <ul className="mt-4 space-y-3.5">
        {perks.map((perk) => (
          <li key={perk.title} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-1/10 text-brand-1 dark:text-brand-3">
              {perk.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{perk.title}</p>
              <p className="mt-0.5 text-sm text-text-muted">{perk.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-1.5 border-t border-border pt-3 text-xs text-text-muted">
        <IconCheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        Everything above is automatic once you finish setup.
      </p>
    </div>
  );
}
