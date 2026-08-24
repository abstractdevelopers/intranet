import type { HTMLAttributes } from "react";

const tones = {
  brand: "bg-brand-3/40 text-brand-2 dark:text-brand-3",
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  danger: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  neutral: "bg-surface-2 text-text-muted",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({
  tone = "neutral",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
      {...props}
    />
  );
}

export function statusTone(status: string): BadgeTone {
  switch (status) {
    case "ACCEPTED":
    case "APPROVED":
    case "ACTIVE":
    case "COMPLETED":
    case "PUBLISHED":
      return "success";
    case "PENDING":
    case "TRIAL":
    case "DRAFT":
      return "warning";
    case "REJECTED":
    case "SUSPENDED":
    case "PAST_DUE":
      return "danger";
    default:
      return "neutral";
  }
}
