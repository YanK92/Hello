import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isUuid, requireCaseSummary } from "@/lib/cases/guard";
import { loadSar } from "@/lib/cases/sar";
import { SarDetailView } from "../sar-views";

export const metadata: Metadata = { title: "Data request" };

async function Sar({ params }: { params: Promise<{ id: string; sarId: string }> }) {
  const { id, sarId } = await params;
  const { userId, caseId } = await requireCaseSummary(id, `/sar/${sarId}`);
  if (!isUuid(sarId)) notFound();
  const sar = await loadSar(caseId, sarId);
  if (!sar) notFound();
  return <SarDetailView caseId={caseId} userId={userId} sar={sar} />;
}

export default function SarDetailPage({ params }: PageProps<"/cases/[id]/sar/[sarId]">) {
  return (
    <div className="stack">
      <Suspense fallback={<p className="muted">Loading request…</p>}>
        <Sar params={params} />
      </Suspense>
    </div>
  );
}
