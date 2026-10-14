import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "How your data is handled" };

export default function PrivacyPage() {
  return (
    <div className="stack">
      <h1>How your data is handled</h1>
      <p className="notice-card card small">
        This is a plain summary. The full privacy policy and terms are being prepared with a solicitor and will replace
        this page before public launch.
      </p>

      <section className="stack-sm">
        <h2>What is stored</h2>
        <ul className="notice-list">
          <li>Your email address and sign-in details.</li>
          <li>
            What you record: cases, entries, locations you choose to add, photos, documents, call recordings,
            transcripts, notes, data requests and contacts.
          </li>
          <li>For each file: its SHA-256 fingerprint and upload time, so you can show it has not changed.</li>
          <li>An audit log of changes (what changed and when, with a fingerprint), kept so records can be checked.</li>
        </ul>
      </section>

      <section className="stack-sm">
        <h2>Who processes it</h2>
        <ul className="notice-list">
          <li>Supabase: database, sign-in and file storage, in the UK/EU region chosen for this service.</li>
          <li>Vercel: hosting, in the London region.</li>
          <li>Resend: reminder emails, only if you turn reminders on.</li>
          <li>Stripe: payments, only if you upgrade. Card details go to Stripe, never to Evidence Locker.</li>
          <li>A transcription service, only if one is set up and you ask for a recording to be transcribed.</li>
        </ul>
      </section>

      <section className="stack-sm">
        <h2>Cookies</h2>
        <p>
          Only the cookies needed to keep you signed in. There are no analytics or advertising cookies, and nothing
          tracks you across other sites.
        </p>
      </section>

      <section className="stack-sm">
        <h2>Your rights</h2>
        <ul className="notice-list">
          <li>
            Download everything stored for your account, or delete your account and all its files, from your{" "}
            <Link href="/account">account page</Link>.
          </li>
          <li>Delete a single case, with its files, from the case page.</li>
          <li>
            For what the rules say about your data rights, or to raise a concern, see the{" "}
            <a href="https://ico.org.uk/for-the-public/" target="_blank" rel="noreferrer">
              Information Commissioner&apos;s Office
            </a>
            .
          </li>
        </ul>
      </section>
    </div>
  );
}
