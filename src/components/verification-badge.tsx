import type { VerificationTier } from "@/lib/constants";

/**
 * The verification tick shown beside a member's name. GOLD is the founding
 * team, BLUE is every other verified account. Renders nothing when the account
 * carries no tier, so callers can drop it in unconditionally.
 */
export function VerificationBadge({
  tier,
  className = "",
}: {
  tier: string | null | undefined;
  className?: string;
}) {
  if (tier !== "GOLD" && tier !== "BLUE") return null;

  const isGold = tier === "GOLD";
  const label = isGold ? "Gold verified account" : "Verified account";

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ verticalAlign: "middle" }}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        {isGold ? (
          <defs>
            <linearGradient id="uca-badge-gold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F5D76E" />
              <stop offset="55%" stopColor="#D4AF37" />
              <stop offset="100%" stopColor="#B8860B" />
            </linearGradient>
          </defs>
        ) : null}
        <path
          d="M12 1.8l2.6 1.9 3.2-.4 1.2 3 2.8 1.6-1 3.1 1 3.1-2.8 1.6-1.2 3-3.2-.4L12 22.2l-2.6-1.9-3.2.4-1.2-3L2.2 16l1-3.1-1-3.1 2.8-1.6 1.2-3 3.2.4L12 1.8Z"
          fill={isGold ? "url(#uca-badge-gold)" : "#1D9BF0"}
        />
        <path
          d="M8.2 12.1l2.5 2.5 4.9-5.2"
          fill="none"
          stroke="#fff"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Convenience for the common "name + optional tick" pair used in lists. */
export function VerifiedName({
  name,
  tier,
  className = "",
}: {
  name: string;
  tier: string | null | undefined;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="truncate">{name}</span>
      <VerificationBadge tier={tier} />
    </span>
  );
}

export function isVerifiedTier(tier: string | null | undefined): tier is VerificationTier {
  return tier === "GOLD" || tier === "BLUE";
}