import "server-only";
import type { EvidenceItem } from "@/components/evidence/evidence-list";
import { createClient } from "@/lib/supabase/server";
import type { Segment } from "@/lib/transcripts/parse";

const AUDIO_URL_SECONDS = 60 * 60;

export type TranscriptStatus = "none" | "pending" | "processing" | "done" | "failed";

export interface RecordingSummary extends EvidenceItem {
  transcriptStatus: TranscriptStatus;
  segmentCount: number;
  highlightCount: number;
}

export interface Highlight {
  id: string;
  startSegment: number;
  endSegment: number;
  quote: string;
  note: string | null;
  createdAt: string;
}

export interface RecordingDetail extends EvidenceItem {
  audioUrl: string | null;
  transcript: {
    id: string;
    status: TranscriptStatus;
    source: "provider" | "import";
    model: string | null;
    error: string | null;
    updatedAt: string;
    segments: Segment[];
  } | null;
  highlights: Highlight[];
}

const EVIDENCE_COLUMNS =
  "id, storage_path, sha256, mime, size, original_name, uploaded_at, hash_verified_at, last_checked_at, last_check_ok";

type EvidenceRow = {
  id: string;
  storage_path: string;
  sha256: string;
  mime: string;
  size: number;
  original_name: string | null;
  uploaded_at: string;
  hash_verified_at: string | null;
  last_checked_at: string | null;
  last_check_ok: boolean | null;
};

function toItem(e: EvidenceRow): EvidenceItem {
  return {
    id: e.id,
    name: e.original_name ?? "Untitled recording",
    mime: e.mime,
    size: e.size,
    sha256: e.sha256,
    uploadedAt: e.uploaded_at,
    hashVerifiedAt: e.hash_verified_at,
    lastCheckedAt: e.last_checked_at,
    lastCheckOk: e.last_check_ok,
    thumbUrl: null,
  };
}

export async function recordingNoticeAcknowledged(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("recording_notice_ack_at").eq("id", userId).maybeSingle();
  return Boolean(data?.recording_notice_ack_at);
}

export async function loadRecordings(caseId: string): Promise<RecordingSummary[]> {
  const supabase = await createClient();
  const [{ data: rows }, { data: transcripts }, { data: highlights }] = await Promise.all([
    supabase
      .from("evidence")
      .select(EVIDENCE_COLUMNS)
      .eq("case_id", caseId)
      .eq("source", "audio")
      .order("uploaded_at", { ascending: false }),
    supabase.from("transcripts").select("id, evidence_id, status, segments").eq("case_id", caseId),
    supabase.from("transcript_highlights").select("transcript_id").eq("case_id", caseId),
  ]);
  return (rows ?? []).map((e) => {
    const t = (transcripts ?? []).find((x) => x.evidence_id === e.id);
    return {
      ...toItem(e),
      transcriptStatus: (t?.status ?? "none") as TranscriptStatus,
      segmentCount: Array.isArray(t?.segments) ? t.segments.length : 0,
      highlightCount: t ? (highlights ?? []).filter((h) => h.transcript_id === t.id).length : 0,
    };
  });
}

export async function loadRecording(caseId: string, evidenceId: string): Promise<RecordingDetail | null> {
  const supabase = await createClient();
  const { data: e } = await supabase
    .from("evidence")
    .select(EVIDENCE_COLUMNS)
    .eq("case_id", caseId)
    .eq("id", evidenceId)
    .eq("source", "audio")
    .maybeSingle();
  if (!e) return null;

  const [{ data: signed }, { data: t }] = await Promise.all([
    supabase.storage.from("evidence").createSignedUrl(e.storage_path, AUDIO_URL_SECONDS),
    supabase
      .from("transcripts")
      .select("id, status, source, model, error, updated_at, segments")
      .eq("evidence_id", e.id)
      .maybeSingle(),
  ]);
  const { data: hs } = t
    ? await supabase
        .from("transcript_highlights")
        .select("id, start_segment, end_segment, quote, note, created_at")
        .eq("transcript_id", t.id)
        .order("start_segment")
    : { data: [] };

  return {
    ...toItem(e),
    audioUrl: signed?.signedUrl ?? null,
    transcript: t
      ? {
          id: t.id,
          status: t.status,
          source: t.source,
          model: t.model,
          error: t.error,
          updatedAt: t.updated_at,
          segments: (t.segments ?? []) as Segment[],
        }
      : null,
    highlights: (hs ?? []).map((h) => ({
      id: h.id,
      startSegment: h.start_segment,
      endSegment: h.end_segment,
      quote: h.quote,
      note: h.note,
      createdAt: h.created_at,
    })),
  };
}
