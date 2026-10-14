"use client";

import { useActionState } from "react";
import { startCheckout } from "./actions";

export const FREE_FEATURES = [
  "Unlimited cases",
  "Photos, documents and call recordings with SHA-256 fingerprints",
  "Check-ins with location and server timestamps",
  "Timeline with edit history",
  "Transcripts, search and highlights",
];

export const PAID_FEATURES = [
  "Data request (SAR) helper: letters, dates and reminders",
  "Case bundle export: indexed PDF and ZIP of originals with a fingerprint manifest",
];

export function UpgradeView({
  status,
  paywallOn,
  hasAccess,
  priceLabel,
}: {
  status: string | null;
  paywallOn: boolean;
  hasAccess: boolean;
  priceLabel: string | null;
}) {
  const [state, action, pending] = useActionState(async () => startCheckout(), null);
  return (
    <div className="stack">
      <h1>Plans</h1>
      {status === "success" && (
        <p className="notice" role="status">
          Payment received. It can take a few seconds for access to show; refresh if needed.
        </p>
      )}
      {status === "cancelled" && <p className="muted">Checkout was cancelled. Nothing was charged.</p>}
      <section className="card stack-sm">
        <h2 className="card-title">Free</h2>
        <ul className="notice-list">
          {FREE_FEATURES.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>
      <section className="card stack-sm plan-paid">
        <h2 className="card-title">Paid{priceLabel && <span className="muted"> · {priceLabel}</span>}</h2>
        <p className="small muted">Everything in Free, plus:</p>
        <ul className="notice-list">
          {PAID_FEATURES.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        {!paywallOn ? (
          <p className="small muted">Payments are not switched on, so every feature is available.</p>
        ) : hasAccess ? (
          <p className="notice">You have the paid plan.</p>
        ) : (
          <form action={action}>
            <button className="button" disabled={pending}>
              {pending ? "Opening checkout…" : "Upgrade"}
            </button>
            {state?.error && <p className="error small">{state.error}</p>}
          </form>
        )}
      </section>
      <p className="small muted">
        Payments are handled by Stripe. Evidence Locker does not see or store your card details.
      </p>
    </div>
  );
}
