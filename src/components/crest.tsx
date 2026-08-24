type LogoProps = { className?: string };

const LOGO_SRC = "/uca-logo.png";
const LOGO_W = 517;
const LOGO_H = 320;

/**
 * The official UCA monogram (white PNG, transparent background).
 * `invert` turns the white mark into brand ink for light surfaces.
 */
export function Crest({ className = "h-8 w-auto", invert = false }: LogoProps & { invert?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt="UCA"
      width={LOGO_W}
      height={LOGO_H}
      className={`${className}${invert ? " dark:invert-0 invert" : ""}`}
    />
  );
}

/** Logo + wordmark lockup for portal headers. */
export function BrandLockup({ subtitle }: { subtitle?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <Crest className="h-7 w-auto shrink-0" invert />
      <span className="leading-tight text-text dark:text-white">
        <span className="block text-[15px] font-bold tracking-tight">UCA Sandbox</span>
        {subtitle ? (
          <span className="block text-[11px] font-medium text-text-muted">{subtitle}</span>
        ) : null}
      </span>
    </span>
  );
}

/** Faint monogram watermark for hero surfaces (white at low opacity). */
export function CrestBackground({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={LOGO_SRC} alt="" width={LOGO_W} height={LOGO_H} aria-hidden className={className} />
  );
}
