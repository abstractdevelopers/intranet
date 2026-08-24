import Link from "next/link";
import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { IconCheckCircle, IconClock } from "@/components/icons";
import { settlePayment } from "@/lib/billing";

export const metadata = { title: "Payment" };

export default async function BillingCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const user = await requireStudent();
  const { reference } = await searchParams;

  let state: "success" | "pending" | "invalid" = "invalid";
  if (reference) {
    const payment = await db.payment.findUnique({ where: { providerRef: reference } });
    if (payment && payment.userId === user.id) {
      if (payment.status === "SUCCESS") {
        state = "success";
      } else {
        try {
          const { settled } = await settlePayment(reference, user.id);
          state = settled ? "success" : "pending";
        } catch {
          state = "pending";
        }
      }
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card className="p-8 text-center">
        {state === "success" ? (
          <>
            <IconCheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
            <h1 className="mt-4 text-xl font-bold">Payment received</h1>
            <p className="mt-2 text-sm text-text-muted">
              Your subscription is active for the next month. Thank you.
            </p>
          </>
        ) : state === "pending" ? (
          <>
            <IconClock className="mx-auto h-12 w-12 text-amber-500" />
            <h1 className="mt-4 text-xl font-bold">Confirming your payment</h1>
            <p className="mt-2 text-sm text-text-muted">
              We&apos;re waiting for the payment provider to confirm. This usually takes a moment —
              check back shortly.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">We couldn&apos;t find that payment</h1>
            <p className="mt-2 text-sm text-text-muted">
              If you completed checkout, your payment will appear once the provider confirms it.
            </p>
          </>
        )}
        <Link
          href="/student/billing"
          className="mt-6 inline-block rounded-lg bg-brand-1 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-2"
        >
          Back to billing
        </Link>
      </Card>
    </div>
  );
}
