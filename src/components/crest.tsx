import type { SVGProps } from "react";

/**
 * The official UCA monogram — geometric block letterforms.
 * Rendered in currentColor so it adapts to the theme:
 * dark ink on light surfaces, white on dark/hero surfaces.
 */
function Monogram({
  strokeWidth = 5,
  ...props
}: Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 126 60"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden
      {...props}
    >
      {/* U — open-top ribbon with perspective lip */}
      <path d="M10 22 V 40 L 34 50 V 8" />
      <path d="M10 22 L 20 15" />
      {/* C — open square */}
      <path d="M76 14 H 54 V 50 H 76" />
      {/* A — diagonal, top, right wall, crossbar */}
      <path d="M86 50 L 98 14 H 116 V 50" />
      <path d="M92 36 H 101" />
    </svg>
  );
}

/** The UCA logo mark. Color comes from context (currentColor). */
export function Crest({ className = "h-8 w-auto" }: { className?: string }) {
  return <Monogram className={className} />;
}

/** Logo + wordmark lockup. */
export function BrandLockup({ subtitle }: { subtitle?: string }) {
  return (
    <span className="flex items-center gap-2.5 text-text dark:text-white">
      <Crest className="h-8 w-auto shrink-0" />
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight">UCA Sandbox</span>
        {subtitle ? (
          <span className="block text-[11px] font-medium text-text-muted">{subtitle}</span>
        ) : null}
      </span>
    </span>
  );
}

/** Faint monogram watermark for hero surfaces. */
export function CrestBackground(props: Omit<SVGProps<SVGSVGElement>, "strokeWidth">) {
  return <Monogram strokeWidth={1.5} {...props} />;
}
