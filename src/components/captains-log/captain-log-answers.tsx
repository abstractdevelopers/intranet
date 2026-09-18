import { CAPTAIN_LOG_QUESTIONS } from "@/lib/constants";

/** Renders a stored Captain's Log response set (#12). */
export function CaptainLogAnswers({ responses }: { responses: string }) {
  let parsed: Record<string, string> = {};
  try {
    const value = JSON.parse(responses);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      parsed = value as Record<string, string>;
    }
  } catch {
    /* stored value isn't JSON — render the questions unanswered */
  }

  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs font-semibold text-brand-1 dark:text-brand-3">
        View answers
      </summary>
      <dl className="mt-3 space-y-3 border-t border-border pt-3">
        {CAPTAIN_LOG_QUESTIONS.map((q) => (
          <div key={q.id}>
            <dt className="text-xs font-semibold text-text-muted">{q.label}</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm">{parsed[q.id] ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}