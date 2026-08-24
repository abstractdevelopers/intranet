import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { PayButtons } from "@/components/pay-buttons";
import { configuredProviders } from "@/lib/payments";
import { monthlyTotal } from "@/lib/billing";
import { formatDate, formatDateTime, formatNaira } from "@/lib/format";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const user = await requireStudent();

  const [subscription, payments] = await Promise.all([
    db.subscription.findUnique({
      where: { userId: user.id },
      include: { items: { include: { course: true } } },
    }),
    db.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 24,
    }),
  ]);

  const now = new Date();
  const total = subscription ? monthlyTotal(subscription.items) : 0;
  const trialActive = subscription?.status === "TRIAL" && subscription.trialEndsAt > now;
  const trialDaysLeft = subscription
    ? Math.max(0, Math.ceil((subscription.trialEndsAt.getTime() - now.getTime()) / 86400000))
    : 0;
  const paymentDue = subscription ? !trialActive && subscription.status !== "ACTIVE" : false;
  const providers = configuredProviders();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-text-muted">
          Your first month is free. After that, each course is ₦15,000/month.
        </p>
      </header>

      {!subscription ? (
        <EmptyState
          title="No subscription yet"
          body="Your subscription is created when your application is approved."
        />
      ) : (
        <>
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Membership</p>
                <p className="mt-1 text-lg font-bold">
                  {trialActive
                    ? `Free month — ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left`
                    : subscription.status === "ACTIVE"
                      ? `Active until ${formatDate(subscription.currentPeriodEnd)}`
                      : subscription.status === "TRIAL"
                        ? "Free month ended"
                        : subscription.status.toLowerCase()}
                </p>
              </div>
              <Badge tone={statusTone(trialActive ? "TRIAL" : subscription.status)}>
                {trialActive ? "trial" : subscription.status.toLowerCase()}
              </Badge>
            </div>

            <ul className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
              {subscription.items.map((i) => (
                <li key={i.id} className="flex justify-between">
                  <span>{i.course.name}</span>
                  <span className="text-text-muted">{formatNaira(i.price)}/month</span>
                </li>
              ))}
              <li className="flex justify-between border-t border-border pt-2 font-semibold">
                <span>Total after your free month</span>
                <span>{formatNaira(total)}/month</span>
              </li>
            </ul>

            {paymentDue ? (
              <div className="mt-5 border-t border-border pt-5">
                <p className="text-sm font-semibold">A payment is due to keep your courses active.</p>
                {providers.length > 0 ? (
                  <div className="mt-3">
                    <PayButtons providers={providers} amount={total} />
                  </div>
                ) : (
                  <p className="mt-3 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-text-muted">
                    Online payments aren&apos;t configured yet. The academy will share payment
                    instructions directly.
                  </p>
                )}
              </div>
            ) : null}
          </Card>

          <section>
            <p className="eyebrow">Payment history</p>
            {payments.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  title="No payments yet"
                  body="Your first payment is due when your free month ends."
                />
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {payments.map((p) => (
                  <li key={p.id}>
                    <Card className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-semibold">{formatNaira(p.amount)}</p>
                        <p className="text-xs text-text-muted">
                          {p.provider.toLowerCase()} · {formatDateTime(p.createdAt)}
                          {p.periodEnd ? ` · covers until ${formatDate(p.periodEnd)}` : ""}
                        </p>
                      </div>
                      <Badge tone={statusTone(p.status)}>{p.status.toLowerCase()}</Badge>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
