"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, currentUserId } from "@/lib/supabase/server";
import { parseTranscript, segmentsToText } from "@/lib/transcripts/parse";
import { transcriptionProvider } from "@/lib/transcripts/provider";
import type { ActionResult } from "./evidence-actions";

const MAX_TRANSCRIPT_CHARS = 500_000;

/** Records that the user has read the note about telling the other party. */
export async function acknowledgeRecordingNotice(): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ recording_notice_ack_at: new Date().toISOString() })
    .eq("id", userId);
  return error ? { ok: false, error: "That could not be saved. Please try again." } : { ok: true };
}

const importSchema = z.object({
  evidenceId: z.uuid(),
  fileName: z.string().max(255),
  content: z.string().min(1, "The transcript is empty.").max(MAX_TRANSCRIPT_CHARS, "That transcript is too long."),
});

/** Saves a transcript the user pasted or uploaded (VTT, SRT or plain text). */
export async function importTranscript(input: unknown): Promise<ActionResult> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!(await currentUserId())) return { ok: false, error: "Please sign in again." };

  const segments = parseTranscript(parsed.data.fileName || "pasted.txt", parsed.data.content);
  if (!segments.length) return { ok: false, error: "No text was found in that transcript." };

  const supabase = await createClient();
  // RLS and the transcripts trigger check the recording is the user's own audio.
  const { error } = await supabase.from("transcripts").upsert(
    {
      evidence_id: parsed.data.evidenceId,
      text: segmentsToText(segments),
      segments,
      status: "done",
      source: "import",
      model: null,
      error: null,
    },
    { onConflict: "evidence_id" },
  );
  return error ? { ok: false, error: "The transcript could not be saved." } : { ok: true };
}

/** Sends a recording to the configured transcription provider. */
export async function transcribeRecording(evidenceId: string): Promise<ActionResult> {
  const provider = transcriptionProvider();
  if (!provider) return { ok: false, error: "Automatic transcription is not set up yet. You can import a transcript." };
  if (!(await currentUserId())) return { ok: false, error: "Please sign in again." };

  const supabase = await createClient();
  const { data: rec } = await supabase
    .from("evidence")
    .select("id, storage_path, mime, source")
    .eq("id", evidenceId)
    .maybeSingle();
  if (!rec || rec.source !== "audio") return { ok: false, error: "Recording not found." };

  await supabase
    .from("transcripts")
    .upsert({ evidence_id: rec.id, status: "processing", source: "provider", text: "" }, { onConflict: "evidence_id" });

  const admin = createAdminClient();
  const { data: blob } = await admin.storage.from("evidence").download(rec.storage_path);
  if (!blob) return { ok: false, error: "The recording file could not be read." };

  try {
    const { segments } = await provider.transcribe(blob, rec.mime);
    await supabase
      .from("transcripts")
      .update({ text: segmentsToText(segments), segments, status: "done", model: provider.model, error: null })
      .eq("evidence_id", rec.id);
    return { ok: true };
  } catch {
    await supabase
      .from("transcripts")
      .update({ status: "failed", error: "The transcription service did not return a transcript." })
      .eq("evidence_id", rec.id);
    return { ok: false, error: "Transcription failed. You can try again or import a transcript." };
  }
}

const highlightSchema = z.object({
  transcriptId: z.uuid(),
  startSegment: z.number().int().min(0),
  endSegment: z.number().int().min(0),
  note: z.string().trim().max(2000).optional().default(""),
});

export async function addHighlight(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = highlightSchema.safeParse(input);
  if (!parsed.success || parsed.data.endSegment < parsed.data.startSegment) {
    return { ok: false, error: "Choose the part of the transcript to highlight." };
  }
  if (!(await currentUserId())) return { ok: false, error: "Please sign in again." };
  const { transcriptId, startSegment, endSegment, note } = parsed.data;

  const supabase = await createClient();
  const { data: t } = await supabase.from("transcripts").select("segments").eq("id", transcriptId).maybeSingle();
  const segments = (t?.segments ?? []) as { text: string; speaker: string | null }[];
  if (!t || endSegment >= segments.length) return { ok: false, error: "That part of the transcript was not found." };

  // Keep the words as they were when highlighted, in case the transcript changes.
  const quote = segments
    .slice(startSegment, endSegment + 1)
    .map((s) => (s.speaker ? `${s.speaker}: ${s.text}` : s.text))
    .join("\n")
    .slice(0, 5000);

  const { data, error } = await supabase
    .from("transcript_highlights")
    .insert({ transcript_id: transcriptId, start_segment: startSegment, end_segment: endSegment, quote, note: note || null })
    .select("id")
    .single();
  return error || !data ? { ok: false, error: "The highlight could not be saved." } : { ok: true, id: data.id };
}

export async function updateHighlightNote(id: string, note: string): Promise<ActionResult> {
  if (!(await currentUserId())) return { ok: false, error: "Please sign in again." };
  const trimmed = note.trim().slice(0, 2000);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transcript_highlights")
    .update({ note: trimmed || null })
    .eq("id", id)
    .select("id");
  return error || !data?.length ? { ok: false, error: "The note could not be saved." } : { ok: true };
}

export async function deleteHighlight(id: string): Promise<ActionResult> {
  if (!(await currentUserId())) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("transcript_highlights").delete().eq("id", id).select("id");
  return error || !data?.length ? { ok: false, error: "The highlight could not be removed." } : { ok: true };
}

export interface TranscriptHit {
  evidenceId: string;
  /** Extract with matches wrapped in <mark>. Only <mark> tags; everything else is escaped on render. */
  headline: string;
}

export async function searchTranscripts(caseId: string, query: string): Promise<ActionResult<{ hits: TranscriptHit[] }>> {
  if (!(await currentUserId())) return { ok: false, error: "Please sign in again." };
  const q = query.trim().slice(0, 200);
  if (!q) return { ok: true, hits: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_transcripts", { p_case_id: caseId, p_query: q });
  if (error) return { ok: false, error: "Search failed. Please try again." };
  return {
    ok: true,
    hits: (data ?? []).map((r: { evidence_id: string; headline: string }) => ({
      evidenceId: r.evidence_id,
      headline: r.headline,
    })),
  };
}
