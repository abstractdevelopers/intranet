import { requireOnboardedStudent } from "@/lib/rbac";
import { PortalShell, type NavSection } from "@/components/portal-shell";
import {
  IconDashboard,
  IconCourses,
  IconAssignments,
  IconProgress,
  IconCalendar,
  IconBell,
  IconWorkspace,
  IconProfile,
  IconStudents,
  IconAnnouncement,
  IconCommunication,
} from "@/components/icons";

const SECTIONS: NavSection[] = [
  {
    label: "Learn",
    items: [
      { href: "/student", label: "Dashboard", icon: IconDashboard },
      { href: "/student/courses", label: "My Courses", icon: IconCourses },
      { href: "/student/assignments", label: "Assignments", icon: IconAssignments },
      { href: "/student/captains-log", label: "Captain's Log", icon: IconAnnouncement },
      { href: "/student/progress", label: "Progress", icon: IconProgress },
    ],
  },
  {
    label: "Creators",
    items: [
      { href: "/student/creators", label: "Discover", icon: IconStudents },
      { href: "/student/projects", label: "My Portfolio", icon: IconWorkspace },
    ],
  },
  {
    label: "Academy",
    items: [
      { href: "/student/calendar", label: "Calendar", icon: IconCalendar },
      { href: "/student/notifications", label: "Notifications", icon: IconBell },
    ],
  },
  {
    label: "You",
    items: [
      { href: "/student/community", label: "Communities", icon: IconCommunication },
      { href: "/student/profile", label: "Profile", icon: IconProfile },
    ],
  },
];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOnboardedStudent();
  return (
    <PortalShell portal="Student Portal" sections={SECTIONS} userName={user.fullName} userRole="Student">
      {children}
    </PortalShell>
  );
}
