export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      <div className="mb-3 h-10 w-10 rounded-full bg-brand-3/40" aria-hidden />
      <p className="text-sm font-semibold">{title}</p>
      {body ? <p className="mt-1 max-w-sm text-sm text-text-muted">{body}</p> : null}
    </div>
  );
}
