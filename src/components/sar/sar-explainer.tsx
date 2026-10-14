const ICO_PUBLIC = "https://ico.org.uk/for-the-public/getting-copies-of-your-information-subject-access-request/";
const ICO_TIME_LIMITS =
  "https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/right-of-access/what-should-we-consider-when-responding-to-a-request/";

/** Factual summary of the ICO's guidance on time limits, with sources. */
export function SarExplainer({ open = false }: { open?: boolean }) {
  return (
    <details className="card explainer" open={open}>
      <summary>What the rules say about time limits</summary>
      <ul className="notice-list small">
        <li>
          An organisation normally has one calendar month to respond, counted from the day it receives the request. If
          there is no matching date in the next month, the last day of that month is used.
        </li>
        <li>
          If the request is complex, or several requests have been made, the organisation can extend by up to two more
          months. It is meant to say so, and why, within the first month.
        </li>
        <li>If the last day falls on a weekend or bank holiday, the organisation has until the next working day.</li>
        <li>
          If the organisation asks for proof of identity or for clarification, the time limit can start, or pause, from
          then.
        </li>
        <li>A copy of your information is usually free.</li>
      </ul>
      <p className="small muted">
        Sources: ICO,{" "}
        <a href={ICO_PUBLIC} target="_blank" rel="noreferrer">
          Getting copies of your information
        </a>{" "}
        and{" "}
        <a href={ICO_TIME_LIMITS} target="_blank" rel="noreferrer">
          responding to a request
        </a>
        . The ICO is updating its guidance for the Data (Use and Access) Act 2025, so check its website for the latest
        position. Dates shown in Evidence Locker are worked out from the dates you enter.
      </p>
    </details>
  );
}
