import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CaseTabs } from "@/components/case-tabs";
import { Timeline } from "@/components/timeline/timeline";
import { requireCase } from "@/lib/cases/guard";

export const metadata: Metadata = { title: "Timeline" };

async function CaseTimeline({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await requireCase(id, "/timeline");
  return (
    <>
      <h1>{data.title}</h1>
      <CaseTabs caseId={data.id} active="timeline" />
      <Timeline caseId={data.id} entries={data.entries} evidence={data.evidence} />
    </>
  );
}

export default function TimelinePage({ params }: PageProps<"/cases/[id]/timeline">) {
  return (
    <div className="stack">
      <p>
        <Link href="/cases">← My cases</Link>
      </p>
      <Suspense fallback={<p className="muted">Loading timeline…</p>}>
        <CaseTimeline params={params} />
      </Suspense>
    </div>
  );
}
