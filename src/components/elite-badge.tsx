/**
 * The Elite badge — the reward for returning early during the reclaim window
 * after the 2026-09-25 incident.
 *
 * A tiny gold UCA crest rather than a drawn gem: it is the academy's own mark,
 * it reads as a medal, and it stays legible on the purple hero band where a
 * purple shape would vanish. Gold matches the founding-team verification tier,
 * so both read as "was here when it counted". The rank is carried in the title
 * and aria-label, not drawn, to keep the mark clean at 16px.
 */
export function EliteBadge({
  memberNumber,
  className = "",
  size = "sm",
}: {
  memberNumber: number | null | undefined;
  className?: string;
  /** Crest height: sm sits inline with names, lg is for the celebration card. */
  size?: "sm" | "lg";
}) {
  if (!memberNumber || memberNumber < 1) return null;

  const label = `Elite member #${memberNumber}`;
  const height = size === "lg" ? "h-9" : "h-[15px]";

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ verticalAlign: "middle" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/elite-crest-gold.png"
        alt=""
        width={22}
        height={14}
        className={`${height} w-auto`}
        aria-hidden
      />
    </span>
  );
}

export function hasElite(number: number | null | undefined): number is number {
  return typeof number === "number" && number >= 1;
}
