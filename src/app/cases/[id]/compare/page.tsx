import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import type { PaneDocument } from "@/components/compare/document-pane";
import { isUuid, requireCaseSummary } from "@/lib/cases/guard";
import { loadCase } from "@/lib/cases/load";
import { createClient } from "@/lib/supabase/server";
import { CompareView } from "./compare-view";

export const metadata: Metadata = { title: "Compare documents" };

async function Compare({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { caseId, title } = await requireCaseSummary(id, "/compare");
  const data = await loadCase(caseId);
  const options = (data?.evidence ?? []).map((e) => ({ id: e.id, name: e.name }));
  const pick = (v: unknown) => (typeof v === "string" && isUuid(v) && options.some((o) => o.id === v) ? v : null);
  const chosen = [pick(query.left), pick(query.right)];

  const supabase = await createClient();
  const ids = chosen.filter((x): x is string => Boolean(x));
  const [{ data: paths }, { data: notes }] = await Promise.all([
    ids.length ? supabase.from("evidence").select("id, storage_path").in("id", ids) : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("document_notes").select("id, evidence_id, page, note").in("evidence_id", ids).order("page", { nullsFirst: true })
      : Promise.resolve({ data: [] }),
  ]);

  async function pane(evidenceId: string | null): Promise<PaneDocument | null> {
    const item = data?.evidence.find((e) => e.id === evidenceId);
    if (!item) return null;
    const path = (paths ?? []).find((p) => p.id === item.id)?.storage_path;
    const signed = path ? (await supabase.storage.from("evidence").createSignedUrl(path, 60 * 60)).data : null;
    return {
      ...item,
      url: signed?.signedUrl ?? null,
      notes: (notes ?? []).filter((n) => n.evidence_id === item.id).map((n) => ({ id: n.id, page: n.page, note: n.note })),
    };
  }

  const [left, right] = await Promise.all([pane(chosen[0]), pane(chosen[1])]);
  return <CompareView caseId={caseId} title={title} options={options} left={left} right={right} />;
}

export default function ComparePage({ params, searchParams }: PageProps<"/cases/[id]/compare">) {
  return (
    <div className="stack">
      <p>
        <Link href="/cases">← My cases</Link>
      </p>
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <Compare params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
