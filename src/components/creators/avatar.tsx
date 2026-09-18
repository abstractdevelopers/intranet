import { IconProfile } from "@/components/icons";

/** A student's profile picture. Falls back to the icon mark when none is set. */
export function Avatar({
  documentId,
  name,
  size = "md",
}: {
  documentId: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims = {
    sm: "h-9 w-9",
    md: "h-12 w-12",
    lg: "h-20 w-20",
  }[size];
  const iconDims = { sm: "h-4.5 w-4.5", md: "h-6 w-6", lg: "h-9 w-9" }[size];

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-3/25 text-brand-1 ring-1 ring-inset ring-brand-1/15 dark:text-brand-3 ${dims}`}
      title={name}
    >
      {documentId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/documents/${documentId}`}
          alt={name}
          className="h-full w-full object-cover"
        />
      ) : (
        <IconProfile className={iconDims} />
      )}
    </span>
  );
}
