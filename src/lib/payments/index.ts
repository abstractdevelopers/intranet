import crypto from "crypto";

export type ProviderName = "PAYSTACK" | "BACHS";

export interface CheckoutInput {
  email: string;
  amount: number; // whole NGN
  currency: string;
  reference: string;
  returnUrl: string;
  cancelUrl: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentProvider {
  name: ProviderName;
  label: string;
  createCheckout(input: CheckoutInput): Promise<{ url: string }>;
  verify(reference: string): Promise<{ success: boolean; amount: number }>;
}

class PaystackProvider implements PaymentProvider {
  name = "PAYSTACK" as const;
  label = "Paystack";
  constructor(private secretKey: string) {}

  async createCheckout(input: CheckoutInput) {
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        amount: input.amount * 100, // kobo
        currency: input.currency,
        reference: input.reference,
        callback_url: input.returnUrl,
        metadata: input.metadata ?? {},
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.data?.authorization_url) {
      throw new Error(data?.message ?? "Paystack checkout failed");
    }
    return { url: data.data.authorization_url as string };
  }

  async verify(reference: string) {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    });
    const data = await res.json();
    const ok = res.ok && data?.data?.status === "success";
    return { success: ok, amount: ok ? Math.round(data.data.amount / 100) : 0 };
  }

  static verifyWebhookSignature(rawBody: string, signature: string, secretKey: string) {
    const expected = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }
}

class BachsProvider implements PaymentProvider {
  name = "BACHS" as const;
  label = "Bachs";
  constructor(
    private apiKey: string,
    private productId: string,
    private baseUrl: string
  ) {}

  async createCheckout(input: CheckoutInput) {
    const res = await fetch(`${this.baseUrl}/v1/checkout-sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_cart: [{ product_id: this.productId, quantity: 1 }],
        billing_currency: input.currency,
        customer: { email: input.email },
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
        metadata: { reference: input.reference, ...(input.metadata ?? {}) },
      }),
    });
    const data = await res.json().catch(() => ({}));
    const url = data?.url ?? data?.checkout_url ?? data?.data?.url;
    if (!res.ok || !url) throw new Error(data?.message ?? "Bachs checkout failed");
    return { url: url as string };
  }

  async verify(reference: string) {
    const res = await fetch(`${this.baseUrl}/v1/checkout-sessions/${reference}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const data = await res.json().catch(() => ({}));
    const status = String(data?.status ?? data?.data?.status ?? "").toUpperCase();
    const success = res.ok && ["PAID", "COMPLETE", "COMPLETED", "SUCCESS"].includes(status);
    return { success, amount: Number(data?.amount ?? 0) };
  }
}

/** Returns the provider when its credentials are configured, else null. */
export function getPaymentProvider(name: string): PaymentProvider | null {
  if (name === "PAYSTACK" && process.env.PAYSTACK_SECRET_KEY) {
    return new PaystackProvider(process.env.PAYSTACK_SECRET_KEY);
  }
  if (name === "BACHS" && process.env.BACHS_KEY && process.env.BACHS_PRODUCT_ID) {
    return new BachsProvider(
      process.env.BACHS_KEY,
      process.env.BACHS_PRODUCT_ID,
      process.env.BACHS_BASE_URL ?? "https://api.bachs.io"
    );
  }
  return null;
}

export function configuredProviders(): { name: ProviderName; label: string }[] {
  return (["PAYSTACK", "BACHS"] as const)
    .map((n) => getPaymentProvider(n))
    .filter((p): p is PaymentProvider => p !== null)
    .map((p) => ({ name: p.name, label: p.label }));
}
