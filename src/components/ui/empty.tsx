import type { ReactNode } from "react";
import { IconSpark } from "../icons";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      <span
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-3/25 text-brand-1 dark:text-brand-3"
        aria-hidden
      >
        <IconSpark className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold">{title}</p>
      {body ? <p className="mt-1 max-w-sm text-sm text-text-muted">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
