import Link from "next/link";

export default function Home() {
  return (
    <div className="stack">
      <h1>Keep a clear record when something goes wrong</h1>
      <p>
        Evidence Locker helps you record what happened with goods or a vehicle you bought: photos,
        documents, notes and dates, each with a timestamp and a fingerprint (SHA-256 hash) so you
        can show it has not changed since you saved it.
      </p>
      <ul>
        <li>Start a case and add the details you already have.</li>
        <li>Keep evidence and notes together, in date order.</li>
        <li>Export everything when you need it.</li>
      </ul>
      <p className="muted">
        This is a records tool. It does not give legal advice or tell you what to do. For guidance
        on your rights, see{" "}
        <a href="https://www.citizensadvice.org.uk/consumer/" rel="noreferrer">
          Citizens Advice
        </a>
        .
      </p>
      <p>
        <Link href="/cases" className="button">
          Go to my cases
        </Link>
      </p>
    </div>
  );
}
