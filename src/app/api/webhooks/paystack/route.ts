import { NextResponse } from "next/server";
import { settlePayment } from "@/lib/billing";
import { getPaymentProvider } from "@/lib/payments";
import crypto from "crypto";

/**
 * Paystack webhook — settles the payment server-side even if the student
 * never returns to the callback URL. Signature-verified.
 */
export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature") ?? "";
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  if (event?.event === "charge.success" && event?.data?.reference) {
    // Our references are namespaced; ignore foreign charges.
    if (String(event.data.reference).startsWith("uca_")) {
      const provider = getPaymentProvider("PAYSTACK");
      if (provider) await settlePayment(event.data.reference);
    }
  }
  return NextResponse.json({ received: true });
}
