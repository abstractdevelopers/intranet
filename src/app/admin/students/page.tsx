import Link from "next/link";
import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Students" };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireStaff();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const students = await db.user.findMany({
    where: {
      role: "STUDENT",
      ...(query
        ? {
            OR: [
              { email: { contains: query } },
              { profile: { fullName: { contains: query } } },
            ],
          }
        : {}),
    },
    include: {
      profile: true,
      enrollments: { include: { course: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight">Students</h1>
      <form className="mt-4" method="get">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by name or email…"
          aria-label="Search students"
          className="w-full max-w-sm rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus:border-brand-1 focus:outline-2 focus:outline-brand-3"
        />
      </form>

      <div className="mt-6 space-y-3">
        {students.length === 0 ? (
          <EmptyState title="No students found" body={query ? "Try a different search." : "Students will appear here once they sign up."} />
        ) : (
          students.map((student) => (
            <Link key={student.id} href={`/admin/students/${student.id}`} className="block">
            <Card className="p-4 transition-colors hover:border-brand-1/40">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{student.profile?.fullName ?? "—"}</p>
                  <p className="text-xs text-text-muted">{student.email} · Joined {formatDate(student.createdAt)}</p>
                </div>
                <Badge tone={statusTone(student.status)}>{student.status.toLowerCase()}</Badge>
              </div>
              {student.enrollments.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {student.enrollments.map((e) => (
                    <Badge key={e.id} tone={statusTone(e.status)}>
                      {e.course.name}: {e.status.toLowerCase()}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
