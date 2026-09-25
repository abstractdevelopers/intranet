/**
 * The Elite badge — the reward for returning early during the reclaim window
 * after the 2026-09-25 incident.
 *
 * Deliberately distinct from the verification ticks: those say "verified
 * account", this says "was here when it counted". A faceted brand-violet gem
 * with the holder's rank set inside, rather than a tick, so the two never read
 * as the same thing.
 */
export function EliteBadge({
  memberNumber,
  className = "",
}: {
  memberNumber: number | null | undefined;
  className?: string;
}) {
  if (!memberNumber || memberNumber < 1) return null;

  const label = `Elite member #${memberNumber}`;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ verticalAlign: "middle" }}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        <defs>
          <linearGradient id="uca-elite-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="55%" stopColor="#570e83" />
            <stop offset="100%" stopColor="#2d0745" />
          </linearGradient>
        </defs>
        {/* Faceted gem: a cut silhouette reads as "award", not "verified". */}
        <path d="M7.4 2.6h9.2l4.4 5.1L12 22 3 7.7 7.4 2.6Z" fill="url(#uca-elite-fill)" />
        {/* Facet lines, faint so they read at 16px. */}
        <path
          d="M3 7.7h18M7.4 2.6 12 22M16.6 2.6 12 22M7.4 2.6 9.6 7.7M16.6 2.6 14.4 7.7"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.42"
          strokeWidth="0.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Highlight across the crown. */}
        <path d="M8.6 3.2h2.2L9 7.1H4.2l1.5-1.8 2.9-2.1Z" fill="#ffffff" fillOpacity="0.18" />
      </svg>
    </span>
  );
}

export function hasElite(number: number | null | undefined): number is number {
  return typeof number === "number" && number >= 1;
}
