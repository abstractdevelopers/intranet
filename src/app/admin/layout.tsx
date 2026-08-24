import { requireStaff } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/applications", label: "Applications" },
  { href: "/admin/enrollments", label: "Enrollments" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/assignments", label: "Assignments" },
  { href: "/admin/submissions", label: "Submissions" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/audit-logs", label: "Audit Logs" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  return (
    <PortalShell brand="Admin Portal" nav={NAV} userName={user.fullName} userRole={user.role.replaceAll("_", " ")}>
      {children}
    </PortalShell>
  );
}
