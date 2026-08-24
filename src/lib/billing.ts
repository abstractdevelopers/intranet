import { db } from "./db";
import { notify, auditLog } from "./audit";
import { getPaymentProvider } from "./payments";

/**
 * Settle a pending payment after the provider confirms it.
 * Idempotent — safe to call from both the redirect callback and webhooks.
 */
export async function settlePayment(providerRef: string, actorId?: string) {
  const payment = await db.payment.findUnique({
    where: { providerRef },
    include: { subscription: { include: { items: true } } },
  });
  if (!payment || payment.status === "SUCCESS") return { settled: false };

  const provider = getPaymentProvider(payment.provider);
  if (!provider) throw new Error("Payment provider is not configured");

  const result = await provider.verify(providerRef);
  if (!result.success) {
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    return { settled: false };
  }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await db.$transaction([
    db.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCESS", paidAt: now, periodStart: now, periodEnd },
    }),
    ...(payment.subscriptionId
      ? [
          db.subscription.update({
            where: { id: payment.subscriptionId },
            data: { status: "ACTIVE", billingStartedAt: now, currentPeriodEnd: periodEnd },
          }),
        ]
      : []),
  ]);

  await notify({
    userId: payment.userId,
    type: "PAYMENT_RECEIVED",
    title: "Payment received",
    body: `Your subscription is active until ${periodEnd.toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })}.`,
  });
  await auditLog({
    actorId: actorId ?? payment.userId,
    action: "PAYMENT_SETTLED",
    targetType: "Payment",
    targetId: payment.id,
    metadata: { provider: payment.provider, amount: payment.amount, reference: providerRef },
  });
  return { settled: true };
}

export function monthlyTotal(items: { price: number }[]) {
  return items.reduce((sum, i) => sum + i.price, 0);
}
