import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient, currentUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My cases" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" });

async function CaseList() {
  if (!(await currentUserId())) redirect("/login?next=/cases");

  const supabase = await createClient();
  const { data: cases, error } = await supabase
    .from("cases")
    .select("id, title, item_description, status, created_at")
    .order("created_at", { ascending: false });

  if (error) return <p className="error">Your cases could not be loaded. Please refresh.</p>;
  if (!cases?.length) {
    return <p className="muted">No cases yet. Start one to begin recording evidence.</p>;
  }

  return (
    <ul className="case-list">
      {cases.map((c) => (
        <li key={c.id}>
          <Link href={`/cases/${c.id}`} className="card">
            <strong>{c.title}</strong>
            {c.item_description && <div className="muted">{c.item_description}</div>}
            <div className="muted" style={{ fontSize: "var(--text-sm)" }}>
              Started {dateFormat.format(new Date(c.created_at))} · {c.status}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function CasesPage() {
  return (
    <div className="stack">
      <h1>My cases</h1>
      <p>
        <Link href="/cases/new" className="button">
          Start a new case
        </Link>
      </p>
      <Suspense fallback={<p className="muted">Loading your cases…</p>}>
        <CaseList />
      </Suspense>
    </div>
  );
}
