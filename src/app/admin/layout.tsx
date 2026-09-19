import { requireStaff } from "@/lib/rbac";
import { PortalShell, type NavSection } from "@/components/portal-shell";

const SECTIONS: NavSection[] = [
  {
    label: "Operate",
    items: [
      { href: "/admin", label: "Dashboard", icon: "Dashboard" },
      { href: "/admin/applications", label: "Applications", icon: "Applications" },
      { href: "/admin/students", label: "Students", icon: "Students" },
      { href: "/admin/enrollments", label: "Enrollments", icon: "Enrollments" },
    ],
  },
  {
    label: "Teach",
    items: [
      { href: "/admin/courses", label: "Courses", icon: "Courses" },
      { href: "/admin/assignments", label: "Assignments", icon: "Assignments" },
      { href: "/admin/submissions", label: "Submissions", icon: "File" },
      { href: "/admin/announcements", label: "Announcements", icon: "Announcement" },
      { href: "/admin/calendar", label: "Calendar", icon: "Calendar" },
    ],
  },
  {
    label: "Academy",
    items: [
      { href: "/admin/captains-log", label: "Captain's Logs", icon: "Announcement" },
      { href: "/admin/projects", label: "Projects", icon: "Workspace" },
      { href: "/admin/communities", label: "Communities", icon: "Communication" },
      { href: "/admin/analytics", label: "Analytics", icon: "Analytics" },
      { href: "/admin/audit-logs", label: "Audit Logs", icon: "Audit" },
      { href: "/admin/settings", label: "Settings", icon: "Settings" },
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
