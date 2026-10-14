import "server-only";
import type { EvidenceItem } from "@/components/evidence/evidence-list";
import { createClient } from "@/lib/supabase/server";

const THUMB_SECONDS = 10 * 60;

export interface TimelineEntry {
  id: string;
  type: string;
  title: string | null;
  occurredAt: string;
  recordedAt: string;
  editedAt: string | null;
  who: string | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  locationLabel: string | null;
  /** Files captured with this entry plus files linked to it. */
  evidence: EvidenceItem[];
  /** Ids of linked (not captured) files, for the edit form. */
  linkedEvidenceIds: string[];
}

export interface CaseData {
  id: string;
  title: string;
  details: [string, string | null][];
  createdAt: string;
  entries: TimelineEntry[];
  evidence: EvidenceItem[];
}

/** Loads a case the signed-in user owns, or null (RLS hides other users' cases). */
export async function loadCase(id: string): Promise<CaseData | null> {
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("cases")
    .select("id, title, item_description, trader_name, finance_provider, agreement_reference, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!c) return null;

  const [{ data: events }, { data: evidence }, { data: links }] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, type, title, occurred_at, recorded_at, edited_at, who, notes, lat, lng, location_accuracy_m, location_label",
      )
      .eq("case_id", id)
      .order("occurred_at", { ascending: true }),
    supabase
      .from("evidence")
      .select(
        "id, event_id, storage_path, sha256, mime, size, original_name, uploaded_at, hash_verified_at, last_checked_at, last_check_ok",
      )
      .eq("case_id", id)
      .order("uploaded_at", { ascending: false }),
    supabase.from("event_evidence").select("event_id, evidence_id").eq("case_id", id),
  ]);

  const imagePaths = (evidence ?? []).filter((e) => e.mime.startsWith("image/")).map((e) => e.storage_path);
  const signed = imagePaths.length
    ? ((await supabase.storage.from("evidence").createSignedUrls(imagePaths, THUMB_SECONDS)).data ?? [])
    : [];
  const urlFor = new Map(signed.map((s) => [s.path, s.signedUrl]));

  const items: EvidenceItem[] = (evidence ?? []).map((e) => ({
    id: e.id,
    name: e.original_name ?? "Untitled file",
    mime: e.mime,
    size: e.size,
    sha256: e.sha256,
    uploadedAt: e.uploaded_at,
    hashVerifiedAt: e.hash_verified_at,
    lastCheckedAt: e.last_checked_at,
    lastCheckOk: e.last_check_ok,
    thumbUrl: urlFor.get(e.storage_path) ?? null,
  }));
  const itemById = new Map(items.map((i) => [i.id, i]));

  const entries: TimelineEntry[] = (events ?? []).map((e) => {
    const captured = (evidence ?? []).filter((x) => x.event_id === e.id).map((x) => x.id);
    const linked = (links ?? []).filter((l) => l.event_id === e.id).map((l) => l.evidence_id as string);
    const ids = [...new Set([...captured, ...linked])];
    return {
      id: e.id,
      type: e.type,
      title: e.title,
      occurredAt: e.occurred_at,
      recordedAt: e.recorded_at,
      editedAt: e.edited_at,
      who: e.who,
      notes: e.notes,
      lat: e.lat,
      lng: e.lng,
      accuracy: e.location_accuracy_m,
      locationLabel: e.location_label,
      evidence: ids.map((x) => itemById.get(x)).filter((x): x is EvidenceItem => Boolean(x)),
      linkedEvidenceIds: linked,
    };
  });

  return {
    id: c.id,
    title: c.title,
    createdAt: c.created_at,
    details: [
      ["Item", c.item_description],
      ["Seller or trader", c.trader_name],
      ["Finance provider", c.finance_provider],
      ["Reference", c.agreement_reference],
    ],
    entries,
    evidence: items,
  };
}
