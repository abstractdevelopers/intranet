export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1">
      {label ? (
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>{label}</span>
          <span>{clamped}%</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full rounded-full bg-brand-1 transition-all" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
