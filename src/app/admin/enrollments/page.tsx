import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Enrollments" };

export default async function EnrollmentsPage() {
  await requireStaff();
  const enrollments = await db.enrollment.findMany({
    include: {
      user: { include: { profile: true } },
      course: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight">Enrollments</h1>
      <div className="mt-6 overflow-x-auto">
        {enrollments.length === 0 ? (
          <EmptyState title="No enrollments yet" />
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
                <th className="py-2 pr-4 font-medium">Student</th>
                <th className="py-2 pr-4 font-medium">Course</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e) => (
                <tr key={e.id} className="border-b border-border">
                  <td className="py-2.5 pr-4">{e.user.profile?.fullName ?? e.user.email}</td>
                  <td className="py-2.5 pr-4">{e.course.name}</td>
                  <td className="py-2.5 pr-4 capitalize">{e.enrollmentType.toLowerCase()}</td>
                  <td className="py-2.5 pr-4"><Badge tone={statusTone(e.status)}>{e.status.toLowerCase()}</Badge></td>
                  <td className="py-2.5 text-text-muted">{formatDateTime(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
