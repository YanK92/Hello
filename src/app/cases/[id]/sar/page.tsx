import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireCaseSummary } from "@/lib/cases/guard";
import { emailRemindersOn, loadSars } from "@/lib/cases/sar";
import { hasPaidAccess } from "@/lib/payments/access";
import { SarListView } from "./sar-views";

export const metadata: Metadata = { title: "Data requests" };

async function Sars({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, caseId, title } = await requireCaseSummary(id, "/sar");
  const [sars, remindersOn, paid] = await Promise.all([loadSars(caseId), emailRemindersOn(userId), hasPaidAccess()]);
  return <SarListView caseId={caseId} title={title} sars={sars} remindersOn={remindersOn} paid={paid} />;
}

export default function SarPage({ params }: PageProps<"/cases/[id]/sar">) {
  return (
    <div className="stack">
      <p>
        <Link href="/cases">← My cases</Link>
      </p>
      <Suspense fallback={<p className="muted">Loading requests…</p>}>
        <Sars params={params} />
      </Suspense>
    </div>
  );
}
