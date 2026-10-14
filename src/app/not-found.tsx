import Link from "next/link";

export default function NotFound() {
  return (
    <div className="stack">
      <h1>Not found</h1>
      <p>This page does not exist, or it belongs to a different account.</p>
      <p>
        <Link href="/cases">Back to my cases</Link>
      </p>
    </div>
  );
}
