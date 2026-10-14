import "server-only";
import { loadCase } from "@/lib/cases/load";
import { loadSar, loadSars } from "@/lib/cases/sar";
import { createClient } from "@/lib/supabase/server";
import type { Segment } from "@/lib/transcripts/parse";
import type { BundleData, BundleFile } from "./bundle";

/** Larger cases should be exported in parts; this keeps a single export within memory limits. */
export const MAX_EXPORT_BYTES = 400 * 1024 * 1024;

export interface ExportSource {
  data: BundleData;
  totalBytes: number;
  bytesFor(f: BundleFile): Promise<Uint8Array | null>;
}

/** Gathers everything for a bundle from the signed-in user's own records (RLS applies). */
export async function collectExport(caseId: string): Promise<ExportSource | null> {
  const c = await loadCase(caseId);
  if (!c) return null;
  const supabase = await createClient();

  const [{ data: paths }, { data: transcripts }, { data: highlights }, sarSummaries, { data: claims }] = await Promise.all([
    supabase.from("evidence").select("id, storage_path").eq("case_id", caseId),
    supabase.from("transcripts").select("id, evidence_id, segments, status").eq("case_id", caseId).eq("status", "done"),
    supabase.from("transcript_highlights").select("transcript_id, start_segment, end_segment, note").eq("case_id", caseId),
    loadSars(caseId),
    supabase.auth.getClaims(),
  ]);
  const sars = (await Promise.all(sarSummaries.map((s) => loadSar(caseId, s.id)))).filter((s) => s !== null);

  // Oldest first, so labels follow the order files were added.
  const evidence = [...c.evidence].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
  const labelFor = new Map(evidence.map((e, i) => [e.id, `F${i + 1}`]));
  const pathFor = new Map((paths ?? []).map((p) => [p.id, p.storage_path as string]));

  const files: BundleFile[] = evidence.map((e) => ({
    id: e.id,
    label: labelFor.get(e.id)!,
    name: e.name,
    mime: e.mime,
    size: e.size,
    sha256: e.sha256,
    uploadedAt: e.uploadedAt,
    hashVerifiedAt: e.hashVerifiedAt,
    entryTitles: c.entries.filter((en) => en.evidence.some((x) => x.id === e.id)).map((en) => en.title ?? en.type),
  }));

  const data: BundleData = {
    caseTitle: c.title,
    details: c.details,
    generatedAt: new Date().toISOString(),
    preparedBy: (claims?.claims.email as string | undefined) ?? null,
    entries: c.entries.map((e) => ({
      occurredAt: e.occurredAt,
      recordedAt: e.recordedAt,
      editedAt: e.editedAt,
      type: e.type,
      title: e.title,
      who: e.who,
      notes: e.notes,
      location:
        e.lat != null && e.lng != null
          ? `${e.lat}, ${e.lng}${e.accuracy != null ? ` (±${e.accuracy} m)` : ""}`
          : e.locationLabel,
      fileLabels: e.evidence.map((x) => labelFor.get(x.id)!).filter(Boolean),
    })),
    files,
    transcripts: (transcripts ?? [])
      .filter((t) => labelFor.has(t.evidence_id))
      .map((t) => ({
        fileLabel: labelFor.get(t.evidence_id)!,
        fileName: evidence.find((e) => e.id === t.evidence_id)?.name ?? "Recording",
        segments: (t.segments ?? []) as Segment[],
        highlights: (highlights ?? [])
          .filter((h) => h.transcript_id === t.id)
          .map((h) => ({ startSegment: h.start_segment, endSegment: h.end_segment, note: h.note })),
      }))
      .sort((a, b) => Number(a.fileLabel.slice(1)) - Number(b.fileLabel.slice(1))),
    sars: sars.map((s) => ({
      recipient: s.recipient,
      status: s.status,
      sentOn: s.sentOn,
      receivedOn: s.receivedOn,
      dueOn: s.dueOn,
      responses: s.responses.map((r) => ({ receivedOn: r.receivedOn, description: r.description })),
    })),
  };

  return {
    data,
    totalBytes: files.reduce((sum, f) => sum + f.size, 0),
    async bytesFor(f) {
      const path = pathFor.get(f.id);
      if (!path) return null;
      const { data: blob } = await supabase.storage.from("evidence").download(path);
      return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
    },
  };
}

export function exportFileName(caseTitle: string, ext: string) {
  const slug = caseTitle.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 50).toLowerCase() || "case";
  const date = new Date().toISOString().slice(0, 10);
  return `${slug}-${date}.${ext}`;
}
