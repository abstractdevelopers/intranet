import { requireStaff } from "@/lib/rbac";
import { PortalShell, type NavSection } from "@/components/portal-shell";
import {
  IconDashboard,
  IconStudents,
  IconApplications,
  IconEnrollments,
  IconCourses,
  IconAssignments,
  IconFile,
  IconAnnouncement,
  IconCalendar,
  IconAnalytics,
  IconAudit,
  IconSettings,
} from "@/components/icons";

const SECTIONS: NavSection[] = [
  {
    label: "Operate",
    items: [
      { href: "/admin", label: "Dashboard", icon: IconDashboard },
      { href: "/admin/applications", label: "Applications", icon: IconApplications },
      { href: "/admin/students", label: "Students", icon: IconStudents },
      { href: "/admin/enrollments", label: "Enrollments", icon: IconEnrollments },
    ],
  },
  {
    label: "Teach",
    items: [
      { href: "/admin/courses", label: "Courses", icon: IconCourses },
      { href: "/admin/assignments", label: "Assignments", icon: IconAssignments },
      { href: "/admin/submissions", label: "Submissions", icon: IconFile },
      { href: "/admin/announcements", label: "Announcements", icon: IconAnnouncement },
      { href: "/admin/calendar", label: "Calendar", icon: IconCalendar },
    ],
  },
  {
    label: "Academy",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: IconAnalytics },
      { href: "/admin/audit-logs", label: "Audit Logs", icon: IconAudit },
      { href: "/admin/settings", label: "Settings", icon: IconSettings },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  return (
    <PortalShell
      portal="Admin Portal"
      sections={SECTIONS}
      userName={user.fullName}
      userRole={user.role.replaceAll("_", " ")}
    >
      {children}
    </PortalShell>
  );
}
