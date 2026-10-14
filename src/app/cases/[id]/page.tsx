import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient, currentUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Case" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});

async function CaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  if (!(await currentUserId())) redirect(`/login?next=/cases/${id}`);

  const supabase = await createClient();
  // RLS returns no row for cases the user does not own, so this is a 404.
  const { data: c } = await supabase
    .from("cases")
    .select(
      "id, title, item_description, trader_name, finance_provider, agreement_reference, status, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();

  const rows: [string, string | null][] = [
    ["Item", c.item_description],
    ["Seller or trader", c.trader_name],
    ["Finance provider", c.finance_provider],
    ["Reference", c.agreement_reference],
    ["Status", c.status],
    ["Started", dateTimeFormat.format(new Date(c.created_at))],
  ];

  return (
    <>
      <h1>{c.title}</h1>
      <dl className="details card">
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: "contents" }}>
            <dt>{label}</dt>
            <dd>{value ?? <span className="muted">Not recorded</span>}</dd>
          </div>
        ))}
      </dl>
      <p className="muted">Evidence capture and the timeline arrive in the next phase.</p>
    </>
  );
}

export default function CasePage({ params }: PageProps<"/cases/[id]">) {
  return (
    <div className="stack">
      <p>
        <Link href="/cases">← My cases</Link>
      </p>
      <Suspense fallback={<p className="muted">Loading case…</p>}>
        <CaseDetail params={params} />
      </Suspense>
    </div>
  );
}
