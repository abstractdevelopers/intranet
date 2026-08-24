export function ProgressRing({
  value,
  size = 56,
  stroke = 5,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" role="img" aria-label={`${clamped}% complete`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-2"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-brand-1 transition-all duration-700 dark:stroke-brand-3"
        />
      </svg>
      <span className="absolute text-xs font-semibold">{label ?? `${clamped}%`}</span>
    </span>
  );
}
