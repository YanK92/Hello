import { registerEvidence } from "@/app/cases/evidence-actions";
import { sha256Hex } from "@/lib/integrity";
import { createClient } from "@/lib/supabase/client";
import { DOCUMENT_MIME_TYPES, evidencePath, rejectReason, type EvidenceMime } from "./rules";

export interface UploadTarget {
  userId: string;
  caseId: string;
  eventId: string | null;
}

export type UploadOutcome = { ok: true; sha256: string } | { ok: false; error: string };

/**
 * Browser side of an evidence upload: hash the file, upload it to the
 * user's private folder (no overwrite), then ask the server to verify the
 * stored copy against that hash and record it.
 */
export async function uploadEvidenceFile(
  file: File,
  target: UploadTarget,
  allowed: readonly EvidenceMime[] = DOCUMENT_MIME_TYPES,
): Promise<UploadOutcome & { evidenceId?: string }> {
  const reason = rejectReason(file, allowed);
  if (reason) return { ok: false, error: reason };

  const sha256 = await sha256Hex(file);
  const path = evidencePath(target.userId, target.caseId, crypto.randomUUID(), file.type as EvidenceMime);

  const supabase = createClient();
  const { error } = await supabase.storage
    .from("evidence")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { ok: false, error: "Upload failed. Check your connection and try again." };

  const result = await registerEvidence({
    caseId: target.caseId,
    eventId: target.eventId,
    storagePath: path,
    sha256,
    originalName: file.name,
  });
  return result.ok ? { ok: true, sha256, evidenceId: result.evidenceId } : { ok: false, error: result.error };
}
