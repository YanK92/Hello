import Link from "next/link";

export function UpgradeCard({ feature }: { feature: string }) {
  return (
    <section className="card stack-sm plan-paid">
      <h2 className="card-title">{feature} is part of the paid plan</h2>
      <p className="small muted">Everything you have already recorded stays available on the free plan.</p>
      <Link href="/upgrade" className="button">
        See plans
      </Link>
    </section>
  );
}
