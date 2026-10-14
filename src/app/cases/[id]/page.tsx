import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CaseView } from "@/components/case-view";
import { requireCase } from "@/lib/cases/guard";

export const metadata: Metadata = { title: "Case" };

async function CaseOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, data } = await requireCase(id);
  return <CaseView data={data} userId={userId} />;
}

export default function CasePage({ params }: PageProps<"/cases/[id]">) {
  return (
    <div className="stack">
      <p>
        <Link href="/cases">← My cases</Link>
      </p>
      <Suspense fallback={<p className="muted">Loading case…</p>}>
        <CaseOverview params={params} />
      </Suspense>
    </div>
  );
}
