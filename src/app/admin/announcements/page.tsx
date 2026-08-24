import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { AnnouncementForm } from "@/components/admin/announcement-form";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Announcements" };

export default async function AdminAnnouncementsPage() {
  await requireStaff();

  const [announcements, courses] = await Promise.all([
    db.announcement.findMany({
      include: { course: { select: { name: true } }, author: { include: { profile: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.course.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
        <p className="mt-1 text-sm text-text-muted">
          Publish to the whole academy or a specific course. Students see announcements in their portal and as notifications.
        </p>
      </header>

      <Card className="p-6">
        <p className="eyebrow">New announcement</p>
        <div className="mt-4">
          <AnnouncementForm courses={courses} />
        </div>
      </Card>

      <section>
        <p className="eyebrow">Published</p>
        {announcements.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No announcements yet" body="Published announcements will appear here." />
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {announcements.map((a) => (
              <li key={a.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <Badge tone={a.audience === "ACADEMY" ? "brand" : "neutral"}>
                      {a.audience === "ACADEMY" ? "Entire academy" : a.course?.name ?? "Course"}
                    </Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{a.body}</p>
                  <p className="mt-3 text-xs text-text-muted">
                    {a.author.profile?.fullName ?? a.author.email} · {formatDateTime(a.createdAt)}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
