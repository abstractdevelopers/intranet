/**
 * The numbered progress rail shown across account setup. Steps are passed in
 * so the reclaim flow can add its time-boxed "Pathway" step without the other
 * screens having to know about it.
 */
export function StepProgress({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs font-semibold">
      {steps.map((label, i) => {
        const n = i + 1;
        const state = n === current ? "current" : n < current ? "done" : "todo";
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                state === "current"
                  ? "bg-brand-1 text-white"
                  : state === "done"
                    ? "bg-brand-1/20 text-brand-1 dark:text-brand-3"
                    : "border border-border text-text-muted"
              }`}
            >
              {n}
            </span>
            <span className={state === "todo" ? "text-text-muted" : ""}>{label}</span>
            {n < steps.length ? <span className="text-text-muted">·</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
