import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/rbac";
import { getPaymentProvider } from "@/lib/payments";
import { monthlyTotal } from "@/lib/billing";

const schema = z.object({ provider: z.enum(["PAYSTACK", "BACHS"]) });

export async function POST(request: Request) {
  const user = await requireStudent();

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a payment method." }, { status: 400 });

  const provider = getPaymentProvider(parsed.data.provider);
  if (!provider) {
    return NextResponse.json({ error: "That payment method isn't configured yet." }, { status: 400 });
  }

  const subscription = await db.subscription.findUnique({
    where: { userId: user.id },
    include: { items: true },
  });
  if (!subscription) return NextResponse.json({ error: "No subscription found." }, { status: 404 });

  // Nothing to pay while the free month is running and the subscription is in good standing.
  if (subscription.status === "TRIAL" && subscription.trialEndsAt > new Date()) {
    return NextResponse.json(
      { error: "Your free month is still running — billing starts when it ends." },
      { status: 400 }
    );
  }

  const amount = monthlyTotal(subscription.items);
  if (amount <= 0) return NextResponse.json({ error: "Nothing to pay." }, { status: 400 });

  // Reuse an existing pending checkout for this period if there is one.
  const pending = await db.payment.findFirst({
    where: { userId: user.id, status: "PENDING", provider: provider.name },
    orderBy: { createdAt: "desc" },
  });

  const origin = new URL(request.url).origin;
  const reference = pending?.providerRef ?? `uca_${crypto.randomBytes(12).toString("hex")}`;

  const payment =
    pending ??
    (await db.payment.create({
      data: {
        userId: user.id,
        subscriptionId: subscription.id,
        amount,
        currency: subscription.currency,
        provider: provider.name,
        providerRef: reference,
      },
    }));

  try {
    const { url } = await provider.createCheckout({
      email: user.email,
      amount: payment.amount,
      currency: payment.currency,
      reference,
      returnUrl: `${origin}/student/billing/callback?reference=${reference}`,
      cancelUrl: `${origin}/student/billing`,
      metadata: { paymentId: payment.id, userId: user.id },
    });
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error("checkout failed", err);
    return NextResponse.json(
      { error: "We couldn't start checkout. Please try again." },
      { status: 502 }
    );
  }
}
