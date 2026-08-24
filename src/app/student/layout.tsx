import { requireStudent } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";

const NAV = [
  { href: "/student", label: "Dashboard" },
  { href: "/student/courses", label: "My Courses" },
  { href: "/student/assignments", label: "Assignments" },
  { href: "/student/progress", label: "Progress" },
  { href: "/student/calendar", label: "Calendar" },
  { href: "/student/notifications", label: "Notifications" },
  { href: "/student/workspace", label: "UCA Workspace" },
  { href: "/student/profile", label: "Profile" },
];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStudent();
  return (
    <PortalShell brand="Student Portal" nav={NAV} userName={user.fullName} userRole="Student">
      {children}
    </PortalShell>
  );
}
