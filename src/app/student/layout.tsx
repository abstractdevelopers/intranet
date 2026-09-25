import { requireOnboardedStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PortalShell, type NavSection } from "@/components/portal-shell";
import { InstallBanner } from "@/components/pwa/install-banner";
import { PushSubscribe } from "@/components/pwa/push-subscribe";

const SECTIONS: NavSection[] = [
  {
    label: "Learn",
    items: [
      { href: "/student", label: "Dashboard", icon: "Dashboard" },
      { href: "/student/courses", label: "My Courses", icon: "Courses" },
      { href: "/student/assignments", label: "Assignments", icon: "Assignments" },
      { href: "/student/captains-log", label: "Captain's Log", icon: "Announcement" },
      { href: "/student/progress", label: "Progress", icon: "Progress" },
    ],
  },
  {
    label: "Creators",
    items: [
      { href: "/student/creators", label: "Discover", icon: "Students" },
      { href: "/student/projects", label: "My Portfolio", icon: "Workspace" },
    ],
  },
  {
    label: "Academy",
    items: [
      { href: "/student/calendar", label: "Calendar", icon: "Calendar" },
      { href: "/student/notifications", label: "Notifications", icon: "Bell" },
    ],
  },
  {
    label: "You",
    items: [
      { href: "/student/community", label: "Communities", icon: "Communication" },
      { href: "/student/profile", label: "Profile", icon: "Profile" },
    ],
  },
];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOnboardedStudent();
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });

  return (
    <PortalShell
      portal="Student Portal"
      sections={SECTIONS}
      userName={user.fullName}
      userRole="Student"
      userTier={user.verificationTier}
      badges={{ "/student/notifications": unread }}
    >
      <InstallBanner />
      <PushSubscribe />
      {children}
    </PortalShell>
  );
}
