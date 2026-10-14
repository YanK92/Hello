"use server";

import { RATE_LIMIT_MESSAGE, withinLimit } from "@/lib/rate-limit";
import { entrySchema, type EntryInput } from "@/lib/chronology";
import { createClient, currentUserId } from "@/lib/supabase/server";
import type { ActionResult } from "./evidence-actions";

function firstIssue(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Check the entry and try again.";
}

/** Replaces the set of evidence linked to an entry. RLS and triggers enforce ownership. */
async function setLinks(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string, evidenceIds: string[]) {
  const { data: current } = await supabase.from("event_evidence").select("evidence_id").eq("event_id", eventId);
  const have = new Set((current ?? []).map((r) => r.evidence_id as string));
  const want = new Set(evidenceIds);
  const remove = [...have].filter((id) => !want.has(id));
  const add = [...want].filter((id) => !have.has(id));
  if (remove.length) {
    const { error } = await supabase.from("event_evidence").delete().eq("event_id", eventId).in("evidence_id", remove);
    if (error) return false;
  }
  if (add.length) {
    const { error } = await supabase
      .from("event_evidence")
      .insert(add.map((evidence_id) => ({ event_id: eventId, evidence_id })));
    if (error) return false;
  }
  return true;
}

export async function createEntry(caseId: string, input: EntryInput): Promise<ActionResult<{ eventId: string }>> {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (!(await currentUserId())) return { ok: false, error: "Please sign in again." };
  if (!(await withinLimit("entry"))) return { ok: false, error: RATE_LIMIT_MESSAGE };

  const { type, title, occurredAt, who, notes, evidenceIds } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({ case_id: caseId, type, title, occurred_at: occurredAt, who: who || null, notes: notes || null })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "The entry could not be saved. Please try again." };

  if (!(await setLinks(supabase, data.id, evidenceIds))) {
    return { ok: false, error: "The entry was saved but some files could not be linked." };
  }
  return { ok: true, eventId: data.id };
}

export async function updateEntry(eventId: string, input: EntryInput): Promise<ActionResult> {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (!(await currentUserId())) return { ok: false, error: "Please sign in again." };
  if (!(await withinLimit("entry"))) return { ok: false, error: RATE_LIMIT_MESSAGE };

  const { type, title, occurredAt, who, notes, evidenceIds } = parsed.data;
  const supabase = await createClient();
  // The database keeps the previous version in event_revisions.
  const { data, error } = await supabase
    .from("events")
    .update({ type, title, occurred_at: occurredAt, who: who || null, notes: notes || null })
    .eq("id", eventId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "The entry could not be updated. Please try again." };

  if (!(await setLinks(supabase, eventId, evidenceIds))) {
    return { ok: false, error: "The entry was updated but some file links could not be changed." };
  }
  return { ok: true };
}

export async function deleteEntry(eventId: string): Promise<ActionResult> {
  if (!(await currentUserId())) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").delete().eq("id", eventId).select("id");
  if (error || !data?.length) return { ok: false, error: "The entry could not be deleted." };
  return { ok: true };
}

export interface Revision {
  revision: number;
  op: "update" | "delete";
  changedAt: string;
  title: string | null;
  type: string;
  occurredAt: string;
  who: string | null;
  notes: string | null;
}

/** Earlier versions of an entry, newest first. */
export async function entryHistory(eventId: string): Promise<ActionResult<{ revisions: Revision[] }>> {
  if (!(await currentUserId())) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_revisions")
    .select("revision, op, changed_at, snapshot")
    .eq("event_id", eventId)
    .order("revision", { ascending: false });
  if (error) return { ok: false, error: "History could not be loaded." };
  return {
    ok: true,
    revisions: (data ?? []).map((r) => ({
      revision: r.revision,
      op: r.op,
      changedAt: r.changed_at,
      title: r.snapshot.title ?? null,
      type: r.snapshot.type,
      occurredAt: r.snapshot.occurred_at,
      who: r.snapshot.who ?? null,
      notes: r.snapshot.notes ?? null,
    })),
  };
}
