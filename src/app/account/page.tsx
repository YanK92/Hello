import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { emailRemindersOn } from "@/lib/cases/sar";
import { hasPaidAccess } from "@/lib/payments/access";
import { paywallEnabled } from "@/lib/payments/stripe";
import { createClient } from "@/lib/supabase/server";
import { AccountView } from "./account-view";

export const metadata: Metadata = { title: "Account" };

async function Account() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?next=/account");
  const [remindersOn, paid] = await Promise.all([emailRemindersOn(data.claims.sub), hasPaidAccess()]);
  const plan = !paywallEnabled() ? "All features (payments off)" : paid ? "Paid" : "Free";
  return <AccountView email={(data.claims.email as string | undefined) ?? ""} remindersOn={remindersOn} plan={plan} />;
}

export default function AccountPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <Account />
    </Suspense>
  );
}
