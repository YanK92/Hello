"use server";

import { RATE_LIMIT_MESSAGE, withinLimit } from "@/lib/rate-limit";
import { checkIntegrity, sha256Hex } from "@/lib/integrity";
import { isAcceptedMime, maxBytesFor, pathBelongsTo, sourceForMime } from "@/lib/evidence/rules";
import { scanUpload } from "@/lib/evidence/scan";
import { contentMatchesType } from "@/lib/evidence/sniff";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, currentUserId } from "@/lib/supabase/server";
import { checkInSchema, locationColumns, registerEvidenceSchema } from "@/lib/validation/evidence";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const BUCKET = "evidence";

/** True if the signed-in user can see (so owns) this case. */
async function ownsCase(caseId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("cases").select("id").eq("id", caseId).maybeSingle();
  return Boolean(data);
}

/**
 * Called after the browser has uploaded a file to storage. The server
 * downloads the stored bytes, hashes them itself and only records the
 * evidence if that hash matches the one the browser computed before upload.
 */
export async function registerEvidence(input: unknown): Promise<ActionResult<{ evidenceId: string }>> {
  const parsed = registerEvidenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That upload could not be recorded." };
  const { caseId, eventId, storagePath, sha256, originalName } = parsed.data;

  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Please sign in again." };
  if (!(await withinLimit("upload"))) return { ok: false, error: RATE_LIMIT_MESSAGE };
  if (!pathBelongsTo(storagePath, userId, caseId) || !(await ownsCase(caseId))) {
    return { ok: false, error: "That upload could not be recorded." };
  }

  const admin = createAdminClient();
  const discard = () => admin.storage.from(BUCKET).remove([storagePath]);

  const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(storagePath);
  if (downloadError || !blob) return { ok: false, error: "The uploaded file could not be found. Please try again." };

  const mime = blob.type.split(";")[0].trim();
  if (!isAcceptedMime(mime) || blob.size === 0 || blob.size > maxBytesFor(mime)) {
    await discard();
    return { ok: false, error: "That file type or size is not supported." };
  }

  // The declared type must match the file's actual content.
  if (!contentMatchesType(new Uint8Array(await blob.slice(0, 64).arrayBuffer()), mime)) {
    await discard();
    return { ok: false, error: "That file's content does not match its type, so it was not saved." };
  }

  if (!(await scanUpload(blob, mime)).clean) {
    await discard();
    return { ok: false, error: "This file could not be accepted by the safety check, so it was not saved." };
  }

  const serverHash = await sha256Hex(blob);
  if (serverHash !== sha256) {
    await discard();
    return { ok: false, error: "The file changed during upload, so it was not saved. Please try again." };
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("evidence")
    .insert({
      case_id: caseId,
      event_id: eventId,
      user_id: userId,
      storage_path: storagePath,
      sha256: serverHash,
      mime,
      size: blob.size,
      source: sourceForMime(mime),
      original_name: originalName || null,
      hash_verified_at: now,
      last_checked_at: now,
      last_check_ok: true,
    })
    .select("id")
    .single();
  if (error || !data) {
    await discard();
    return { ok: false, error: "The file could not be recorded. Please try again." };
  }
  return { ok: true, evidenceId: data.id };
}

/** Re-hashes a stored file and records whether it still matches. */
export async function recheckEvidence(evidenceId: string): Promise<ActionResult<{ matches: boolean }>> {
  if (!(await currentUserId())) return { ok: false, error: "Please sign in again." };

  // RLS: only returns the row if it belongs to the signed-in user.
  const supabase = await createClient();
  const { data: ev } = await supabase
    .from("evidence")
    .select("id, storage_path, sha256")
    .eq("id", evidenceId)
    .maybeSingle();
  if (!ev) return { ok: false, error: "Evidence not found." };

  const admin = createAdminClient();
  const { data: blob } = await admin.storage.from(BUCKET).download(ev.storage_path);
  // A missing file counts as a failed check.
  const matches = blob ? (await checkIntegrity(blob, ev.sha256)).ok : false;

  await admin
    .from("evidence")
    .update({ last_checked_at: new Date().toISOString(), last_check_ok: matches })
    .eq("id", ev.id);

  return { ok: true, matches };
}

/** Records where the user is now, as a timestamped entry on the case. */
export async function addCheckIn(input: unknown): Promise<ActionResult<{ eventId: string }>> {
  const parsed = checkInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!(await currentUserId())) return { ok: false, error: "Please sign in again." };
  if (!(await withinLimit("entry"))) return { ok: false, error: RATE_LIMIT_MESSAGE };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      case_id: parsed.data.caseId,
      type: "check_in",
      occurred_at: new Date().toISOString(),
      notes: parsed.data.notes || null,
      ...locationColumns(parsed.data.location),
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "The check-in could not be saved. Please try again." };
  return { ok: true, eventId: data.id };
}
