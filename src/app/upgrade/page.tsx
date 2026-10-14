import type { Metadata } from "next";
import { Suspense } from "react";
import { hasPaidAccess } from "@/lib/payments/access";
import { paywallEnabled } from "@/lib/payments/stripe";
import { UpgradeView } from "./upgrade-view";

export const metadata: Metadata = { title: "Plans" };

async function Upgrade({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const status = typeof query.status === "string" ? query.status : null;
  return (
    <UpgradeView
      status={status}
      paywallOn={paywallEnabled()}
      hasAccess={await hasPaidAccess()}
      priceLabel={process.env.NEXT_PUBLIC_PRICE_LABEL ?? null}
    />
  );
}

export default function UpgradePage({ searchParams }: PageProps<"/upgrade">) {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <Upgrade searchParams={searchParams} />
    </Suspense>
  );
}
