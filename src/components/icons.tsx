import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

// --- Navigation ---
export const IconDashboard = (p: IconProps) => (
  <Svg {...p}><path d="M4 13.5a8 8 0 1 1 16 0" /><path d="M12 13.5 15.5 9" /><path d="M4 17.5h16" /></Svg>
);
export const IconCourses = (p: IconProps) => (
  <Svg {...p}><path d="M12 6.5C10 4.8 7.2 4.3 4 4.5v13c3.2-.2 6 .3 8 2 2-1.7 4.8-2.2 8-2v-13c-3.2-.2-6 .3-8 2Z" /><path d="M12 6.5v13" /></Svg>
);
export const IconAssignments = (p: IconProps) => (
  <Svg {...p}><path d="M14.5 4.5 19 9l-9.5 9.5H5V14L14.5 4.5Z" /><path d="m12.5 6.5 4.5 4.5" /><path d="M5 19h14" /></Svg>
);
export const IconProgress = (p: IconProps) => (
  <Svg {...p}><path d="M4 20V4" /><path d="M4 20h16" /><path d="m7 14 3.5-4 3 2.5L18 7" /><path d="M18 7v3M18 7h-3" /></Svg>
);
export const IconCalendar = (p: IconProps) => (
  <Svg {...p}><rect x="4" y="5.5" width="16" height="14" rx="2" /><path d="M4 10h16" /><path d="M8.5 3.5v4M15.5 3.5v4" /><path d="M8 14h2.5M13.5 14H16M8 17h2.5" /></Svg>
);
export const IconBell = (p: IconProps) => (
  <Svg {...p}><path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2.5h-15L6 16Z" /><path d="M10 21a2.2 2.2 0 0 0 4 0" /></Svg>
);
export const IconWorkspace = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="4.5" width="18" height="15" rx="2" /><path d="m7 9.5 3 2.75L7 15" /><path d="M12.5 15H17" /></Svg>
);
export const IconProfile = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 19.5c1.5-3.2 4-4.5 7-4.5s5.5 1.3 7 4.5" /></Svg>
);
export const IconLogout = (p: IconProps) => (
  <Svg {...p}><path d="M14 4.5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h7" /><path d="m17 8.5 3.5 3.5-3.5 3.5" /><path d="M20.5 12H10" /></Svg>
);

// --- Learning states ---
export const IconCheck = (p: IconProps) => (
  <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>
);
export const IconCheckCircle = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12.2 2.5 2.5 4.8-5" /></Svg>
);
export const IconLock = (p: IconProps) => (
  <Svg {...p}><rect x="5.5" y="10.5" width="13" height="9" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /><path d="M12 14.5v2" /></Svg>
);
export const IconClock = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2.5" /></Svg>
);
export const IconPlay = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M10 8.8v6.4l5.5-3.2L10 8.8Z" /></Svg>
);
export const IconArrowRight = (p: IconProps) => (
  <Svg {...p}><path d="M4.5 12h15" /><path d="m13.5 6 6 6-6 6" /></Svg>
);
export const IconFile = (p: IconProps) => (
  <Svg {...p}><path d="M6.5 3.5h7L19 9v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V5a1.5 1.5 0 0 1 1.5-1.5Z" /><path d="M13.5 3.5V9H19" /></Svg>
);

// --- Achievement ---
export const IconTrophy = (p: IconProps) => (
  <Svg {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 5.5H5a3 3 0 0 0 3 4M16 5.5h3a3 3 0 0 1-3 4" /><path d="M12 13v3.5" /><path d="M8.5 19.5h7l-1-3h-5l-1 3Z" /></Svg>
);
export const IconMedal = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="14" r="5" /><path d="m10.5 14 1.2 1.2 2.3-2.4" /><path d="M8.5 9.5 5.5 3.5h4L12 8l2.5-4.5h4L15.5 9.5" /></Svg>
);
export const IconCertificate = (p: IconProps) => (
  <Svg {...p}><rect x="4" y="4.5" width="16" height="12" rx="1.5" /><circle cx="12" cy="10.5" r="2.5" /><path d="m10.8 12.7-1 4.3 2.2-1.4 2.2 1.4-1-4.3" /><path d="M7 8h2M15 8h2M7 13h1.5" /></Svg>
);
export const IconMilestone = (p: IconProps) => (
  <Svg {...p}><path d="M6 21V4" /><path d="M6 5h11l-2.5 3.5L17 12H6" /></Svg>
);
export const IconSpark = (p: IconProps) => (
  <Svg {...p}><path d="M12 3.5 13.8 10l6.5 2-6.5 2L12 20.5 10.2 14l-6.5-2 6.5-2L12 3.5Z" /></Svg>
);
export const IconTarget = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /></Svg>
);

// --- Course identity ---
export const IconBranding = (p: IconProps) => (
  <Svg {...p}><rect x="4" y="4.5" width="16" height="15" rx="2.5" /><circle cx="9" cy="10" r="2" /><path d="M6 16c.7-1.8 1.7-2.5 3-2.5s2.3.7 3 2.5" /><path d="M14.5 9.5H18M14.5 13H18M14.5 16.5h2" /></Svg>
);
export const IconSocial = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="2.5" /><path d="M12 9.5V6.5M14.2 10.8l2.1-2.1M14.5 12h3M14.2 13.2l2.1 2.1M12 14.5v3M9.8 13.2l-2.1 2.1M9.5 12h-3M9.8 10.8 7.7 8.7" /><circle cx="12" cy="5" r="1.3" /><circle cx="18" cy="12" r="1.3" /><circle cx="12" cy="19" r="1.3" /><circle cx="6" cy="12" r="1.3" /></Svg>
);
export const IconVideo = (p: IconProps) => (
  <Svg {...p}><path d="M4 9.5h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8Z" /><path d="m4.5 9.5 1.5-4h12l1.5 4" /><path d="m8 5.5 1.5 4M12.5 5.5l1.5 4M17 5.5l1 2.5" /><path d="m10.5 13 3.5 2-3.5 2v-4Z" /></Svg>
);
export const IconDesign = (p: IconProps) => (
  <Svg {...p}><path d="m5 19 1.2-4.2L16.5 4.5a2.1 2.1 0 0 1 3 3L9.2 17.8 5 19Z" /><path d="m14.5 6.5 3 3" /><path d="M5 19c2-3 4-.5 6-2.5" /></Svg>
);
export const IconCommunication = (p: IconProps) => (
  <Svg {...p}><path d="M4 10.5v3a1.5 1.5 0 0 0 1.5 1.5H8l7 4v-13l-7 4H5.5A1.5 1.5 0 0 0 4 10.5Z" /><path d="M18 9.5a4.5 4.5 0 0 1 0 5" /><path d="M8 15.5V19a1.5 1.5 0 0 0 3 0v-2.5" /></Svg>
);
export const IconWriting = (p: IconProps) => (
  <Svg {...p}><path d="M19.5 4.5c-5.5.5-9.5 3-11.5 7.5L6 19.5l7.5-2C18 15.5 19.5 10 19.5 4.5Z" /><path d="M6 19.5 15.5 10" /><path d="M4.5 21.5c1-1.5 2.5-2 4-2" /></Svg>
);

// --- Admin ---
export const IconStudents = (p: IconProps) => (
  <Svg {...p}><circle cx="9" cy="8.5" r="3" /><path d="M3.5 18.5c1.2-2.7 3.2-4 5.5-4s4.3 1.3 5.5 4" /><circle cx="16.5" cy="9.5" r="2.3" /><path d="M16 14.5c2 .2 3.7 1.4 4.5 3.7" /></Svg>
);
export const IconApplications = (p: IconProps) => (
  <Svg {...p}><path d="M5 4.5h9L19 9.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5.5A1.5 1.5 0 0 1 6.5 4.5Z" /><path d="M14 4.5V9.5H19" /><path d="m8.5 14.5 2.3 2.3 4.2-4.6" /></Svg>
);
export const IconEnrollments = (p: IconProps) => (
  <Svg {...p}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 3v1" /><path d="M9 10h6M9 13.5h6M9 17h3.5" /></Svg>
);
export const IconAnalytics = (p: IconProps) => (
  <Svg {...p}><path d="M4.5 19.5h15" /><path d="M7 16.5v-4M11 16.5V8.5M15 16.5v-6.5M19 16.5V5.5" /></Svg>
);
export const IconAudit = (p: IconProps) => (
  <Svg {...p}><path d="M12 3.5 5 6v5c0 4.5 3 7.8 7 9.5 4-1.7 7-5 7-9.5V6l-7-2.5Z" /><path d="M12 8v4" /><circle cx="12" cy="15" r=".9" fill="currentColor" stroke="none" /></Svg>
);
export const IconSettings = (p: IconProps) => (
  <Svg {...p}><path d="M5 7h9M18 7h1.5" /><circle cx="16" cy="7" r="2.2" /><path d="M5 12h3M12 12h7.5" /><circle cx="10" cy="12" r="2.2" /><path d="M5 17h10.5M19 17h.5" /><circle cx="17.5" cy="17" r="2.2" /></Svg>
);
export const IconAnnouncement = (p: IconProps) => (
  <Svg {...p}><path d="M18.5 5.5 6 9.5v5l2 .6V19a1.6 1.6 0 0 0 3.2 0v-2.6l7.3 3.1V5.5Z" /><path d="M6 9.5H4.8A1.3 1.3 0 0 0 3.5 10.8v2.4A1.3 1.3 0 0 0 4.8 14.5H6" /></Svg>
);
