import { NextResponse, type NextRequest } from "next/server";
import { handleStripeEvent, verifyStripeSignature, type StripeEvent } from "@/lib/payments/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/** Stripe webhook: the only place paid access is granted or revoked. */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const payload = await request.text();
  if (!secret || !verifyStripeSignature(payload, request.headers.get("stripe-signature") ?? "", secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();
  await handleStripeEvent(JSON.parse(payload) as StripeEvent, {
    async alreadyProcessed(id) {
      const { data } = await admin.from("stripe_events").select("id").eq("id", id).maybeSingle();
      return Boolean(data);
    },
    async markProcessed(id, type) {
      await admin.from("stripe_events").insert({ id, type });
    },
    async grant(userId, ids) {
      const { error } = await admin.from("entitlements").upsert({
        user_id: userId,
        plan: "paid",
        source: "stripe",
        stripe_customer_id: ids.customer,
        stripe_checkout_session_id: ids.session,
        stripe_subscription_id: ids.subscription,
        granted_at: new Date().toISOString(),
        revoked_at: null,
      });
      if (error) throw error;
    },
    async revokeBySubscription(subscriptionId) {
      await admin
        .from("entitlements")
        .update({ revoked_at: new Date().toISOString() })
        .eq("stripe_subscription_id", subscriptionId);
    },
  });

  return NextResponse.json({ received: true });
}
