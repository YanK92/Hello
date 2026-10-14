import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireCaseSummary } from "@/lib/cases/guard";
import { loadCase } from "@/lib/cases/load";
import { loadSars } from "@/lib/cases/sar";
import { MAX_EXPORT_BYTES } from "@/lib/export/collect";
import { hasPaidAccess } from "@/lib/payments/access";
import { createClient } from "@/lib/supabase/server";
import { ExportView } from "./export-view";

export const metadata: Metadata = { title: "Export" };

async function Export({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { caseId, title } = await requireCaseSummary(id, "/export");
  const supabase = await createClient();
  const [data, sars, paid, { count }] = await Promise.all([
    loadCase(caseId),
    loadSars(caseId),
    hasPaidAccess(),
    supabase.from("transcripts").select("id", { count: "exact", head: true }).eq("case_id", caseId).eq("status", "done"),
  ]);
  const bytes = (data?.evidence ?? []).reduce((s, e) => s + e.size, 0);
  return (
    <ExportView
      caseId={caseId}
      title={title}
      paid={paid}
      summary={{
        entries: data?.entries.length ?? 0,
        files: data?.evidence.length ?? 0,
        bytes,
        transcripts: count ?? 0,
        sars: sars.length,
        tooLarge: bytes > MAX_EXPORT_BYTES,
      }}
    />
  );
}

export default function ExportPage({ params }: PageProps<"/cases/[id]/export">) {
  return (
    <div className="stack">
      <p>
        <Link href="/cases">← My cases</Link>
      </p>
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <Export params={params} />
      </Suspense>
    </div>
  );
}
