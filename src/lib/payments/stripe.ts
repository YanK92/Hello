import { createHmac, timingSafeEqual } from "node:crypto";

// Stripe over its HTTP API (no SDK). Paid access is granted only from
// verified webhook events, never from the browser returning from Checkout.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Verifies a Stripe-Signature header (v1 scheme) within a 5 minute tolerance. */
export function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
  now: number = Date.now(),
  toleranceSeconds = 300,
): boolean {
  const parts = header.split(",").map((p) => p.split("="));
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(t) || !signatures.length) return false;
  if (Math.abs(now / 1000 - t) > toleranceSeconds) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex"));
  return signatures.some((sig) => {
    const given = Buffer.from(sig ?? "");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export interface StripeEventDeps {
  alreadyProcessed(id: string): Promise<boolean>;
  markProcessed(id: string, type: string): Promise<void>;
  grant(userId: string, ids: { customer: string | null; session: string; subscription: string | null }): Promise<void>;
  revokeBySubscription(subscriptionId: string): Promise<void>;
}

export async function handleStripeEvent(event: StripeEvent, deps: StripeEventDeps): Promise<void> {
  if (await deps.alreadyProcessed(event.id)) return;
  const o = event.data.object;

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const userId = typeof o.client_reference_id === "string" ? o.client_reference_id : "";
    const paid = o.payment_status === "paid" || o.payment_status === "no_payment_required";
    if (paid && UUID.test(userId)) {
      await deps.grant(userId, {
        customer: typeof o.customer === "string" ? o.customer : null,
        session: String(o.id),
        subscription: typeof o.subscription === "string" ? o.subscription : null,
      });
    }
  } else if (event.type === "customer.subscription.deleted") {
    await deps.revokeBySubscription(String(o.id));
  }

  await deps.markProcessed(event.id, event.type);
}

/** Payments are on when a price is configured; otherwise everything is unlocked. */
export function paywallEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

/** Creates a Checkout Session for the signed-in user and returns its URL. */
export async function createCheckoutSession(opts: { userId: string; email: string | null; origin: string }) {
  const mode = process.env.STRIPE_MODE === "subscription" ? "subscription" : "payment";
  const form = new URLSearchParams({
    mode,
    "line_items[0][price]": process.env.STRIPE_PRICE_ID!,
    "line_items[0][quantity]": "1",
    client_reference_id: opts.userId,
    success_url: `${opts.origin}/upgrade?status=success`,
    cancel_url: `${opts.origin}/upgrade?status=cancelled`,
  });
  if (opts.email) form.set("customer_email", opts.email);
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  if (!res.ok) throw new Error(`Stripe responded ${res.status}`);
  const session = (await res.json()) as { url: string };
  return session.url;
}
