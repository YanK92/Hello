import Link from "next/link";
import { DeleteAccountForm } from "@/components/danger-forms";
import { RemindersToggle } from "@/components/sar/reminders-toggle";

export function AccountView({ email, remindersOn, plan }: { email: string; remindersOn: boolean; plan: string }) {
  return (
    <div className="stack">
      <h1>Your account</h1>
      <section className="card stack-sm">
        <dl className="details">
          <dt>Email</dt>
          <dd>{email}</dd>
          <dt>Plan</dt>
          <dd>
            {plan} · <Link href="/upgrade">Plans</Link>
          </dd>
        </dl>
      </section>
      <section className="card stack-sm" aria-labelledby="reminders-heading">
        <h2 id="reminders-heading" className="card-title">
          Email reminders
        </h2>
        <RemindersToggle initial={remindersOn} />
      </section>
      <section className="card stack-sm" aria-labelledby="your-data-heading">
        <h2 id="your-data-heading" className="card-title">
          Your data
        </h2>
        <p className="small">
          Download everything stored for your account: every record as JSON, and all your files with their SHA-256
          fingerprints.
        </p>
        <a className="button" data-variant="secondary" href="/account/export" download>
          Download all my data
        </a>
        <p className="small muted">
          See <Link href="/privacy">how your data is handled</Link>.
        </p>
      </section>
      <details className="card danger-zone">
        <summary>Delete my account</summary>
        <DeleteAccountForm />
      </details>
    </div>
  );
}
