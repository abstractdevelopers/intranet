import type { SVGProps } from "react";

/**
 * The UCA crest — the academy's proprietary mark.
 * A forward-leaning shield carrying the UCA monogram and a milestone notch.
 */
export function Crest({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 44" className={className} aria-hidden>
      <path
        d="M20 1.5 37 8v13c0 10.5-7 18.2-17 21.5C10 39.2 3 31.5 3 21V8l17-6.5Z"
        fill="#570E83"
      />
      <path
        d="M20 4.8 34 10.2V21c0 8.8-5.7 15.4-14 18.4C11.7 36.4 6 29.8 6 21V10.2L20 4.8Z"
        fill="#410B61"
      />
      <text
        x="20"
        y="23.5"
        textAnchor="middle"
        fontFamily="Poppins, sans-serif"
        fontWeight={700}
        fontSize="11"
        fill="#E6A9FF"
        letterSpacing="0.5"
      >
        UCA
      </text>
      <path d="M13 28.5h14" stroke="#E6A9FF" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M17 32h6" stroke="#E6A9FF" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

/** Crest + wordmark lockup. */
export function BrandLockup({ subtitle }: { subtitle?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <Crest className="h-9 w-9 shrink-0" />
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight">UCA Sandbox</span>
        {subtitle ? (
          <span className="block text-[11px] font-medium text-text-muted">{subtitle}</span>
        ) : null}
      </span>
    </span>
  );
}

export function CrestBackground(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 44" fill="none" aria-hidden {...props}>
      <path
        d="M20 1.5 37 8v13c0 10.5-7 18.2-17 21.5C10 39.2 3 31.5 3 21V8l17-6.5Z"
        stroke="currentColor"
        strokeWidth="0.75"
      />
    </svg>
  );
}
