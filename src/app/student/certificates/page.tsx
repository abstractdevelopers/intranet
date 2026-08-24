import Link from "next/link";
import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { CourseMark } from "@/components/course-mark";
import { IconCertificate } from "@/components/icons";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Certificates" };

export default async function CertificatesPage() {
  const user = await requireStudent();
  const certificates = await db.certificate.findMany({
    where: { userId: user.id },
    include: { course: true },
    orderBy: { issuedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight">Certificates</h1>
      <p className="mt-1 text-sm text-text-muted">
        Earned when you complete every lesson and pass every assignment in a course.
      </p>

      {certificates.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No certificates yet"
            body="Finish a course — every lesson and every assignment — and your certificate appears here."
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {certificates.map((c) => (
            <li key={c.id}>
              <Card className="flex items-center gap-4 p-5">
                <CourseMark slug={c.course.slug} size="sm" />
                <div className="flex-1">
                  <p className="text-sm font-bold">{c.course.name}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    Issued {formatDate(c.issuedAt)} · ID{" "}
                    <span className="font-mono font-semibold">{c.certificateId}</span>
                  </p>
                </div>
                <Link
                  href={`/verify/${c.certificateId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:border-brand-1 hover:text-brand-1 dark:hover:text-brand-3"
                >
                  <IconCertificate className="h-4 w-4" /> View
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
