"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createCheckoutSession, paywallEnabled } from "@/lib/payments/stripe";
import { createClient } from "@/lib/supabase/server";

export async function startCheckout(): Promise<{ error: string }> {
  if (!paywallEnabled()) return { error: "Payments are not switched on." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?next=/upgrade");

  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  let url: string;
  try {
    url = await createCheckoutSession({
      userId: data.claims.sub,
      email: (data.claims.email as string | undefined) ?? null,
      origin,
    });
  } catch {
    return { error: "Checkout could not be started. Please try again." };
  }
  redirect(url);
}
