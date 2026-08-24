import { createElement, type ComponentType, type SVGProps } from "react";
import {
  IconBranding,
  IconSocial,
  IconVideo,
  IconDesign,
  IconCommunication,
  IconWriting,
  IconCourses,
} from "./icons";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const COURSE_ICONS: Record<string, IconComponent> = {
  "personal-branding": IconBranding,
  "social-media": IconSocial,
  "video-editing": IconVideo,
  "graphics-design": IconDesign,
  "communication-influence": IconCommunication,
  "content-writing": IconWriting,
};

export function courseIcon(slug: string): IconComponent {
  return COURSE_ICONS[slug] ?? IconCourses;
}

/**
 * The course mark — a brand-gradient tile carrying the course's icon.
 * Gives every course a consistent, premium identity across the academy.
 */
export function CourseMark({
  slug,
  size = "md",
}: {
  slug: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims = {
    sm: "h-9 w-9 rounded-lg",
    md: "h-11 w-11 rounded-xl",
    lg: "h-16 w-16 rounded-2xl",
  }[size];
  const iconDims = { sm: "h-4.5 w-4.5", md: "h-5.5 w-5.5", lg: "h-8 w-8" }[size];
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center bg-gradient-to-br from-brand-1 to-brand-2 ${dims}`}
      aria-hidden
    >
      <span className="absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/15" />
      {createElement(courseIcon(slug), { className: `${iconDims} text-brand-3` })}
    </span>
  );
}
