import Link from "next/link";
import { db } from "@/lib/db";
import { Crest } from "@/components/crest";
import { Card } from "@/components/ui/card";
import { IconCheckCircle } from "@/components/icons";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Certificate verification · UCA Sandbox" };

/** Public certificate verification — anyone with the ID can confirm it's genuine. */
export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ certificateId: string }>;
}) {
  const { certificateId } = await params;
  const certificate = await db.certificate.findUnique({
    where: { certificateId },
    include: { user: { include: { profile: true } }, course: { select: { name: true } } },
  });

  return (
    <div className="flex min-h-screen flex-col items-center bg-surface-2 px-4 py-16 dark:bg-ink">
      <Link href="/login" aria-label="UCA Sandbox">
        <Crest className="h-10 w-auto" invert />
      </Link>

      <Card className="mt-10 w-full max-w-md p-8 text-center">
        {certificate ? (
          <>
            <IconCheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
            <h1 className="mt-4 text-xl font-bold">Certificate verified</h1>
            <dl className="mt-6 space-y-3 text-left text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <dt className="text-text-muted">Awarded to</dt>
                <dd className="font-semibold">
                  {certificate.user.profile?.fullName ?? certificate.user.email}
                </dd>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <dt className="text-text-muted">Course</dt>
                <dd className="font-semibold">{certificate.course.name}</dd>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <dt className="text-text-muted">Academy</dt>
                <dd className="font-semibold">UCA Sandbox</dd>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <dt className="text-text-muted">Completed</dt>
                <dd className="font-semibold">{formatDate(certificate.issuedAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Certificate ID</dt>
                <dd className="font-mono text-xs font-semibold">{certificate.certificateId}</dd>
              </div>
            </dl>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">Certificate not found</h1>
            <p className="mt-2 text-sm text-text-muted">
              No certificate matches this ID. Check the ID and try again.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
