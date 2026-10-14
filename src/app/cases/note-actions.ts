"use server";

import { RATE_LIMIT_MESSAGE, withinLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { createClient, currentUserId } from "@/lib/supabase/server";
import type { ActionResult } from "./evidence-actions";

const noteSchema = z.object({
  evidenceId: z.uuid(),
  page: z.number().int().min(1).max(100000).nullable(),
  note: z.string().trim().min(1, "Write a note first.").max(2000),
});

export async function addDocumentNote(input: unknown): Promise<ActionResult> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!(await currentUserId())) return { ok: false, error: "Please sign in again." };
  if (!(await withinLimit("note"))) return { ok: false, error: RATE_LIMIT_MESSAGE };
  const supabase = await createClient();
  // The trigger and RLS check the document is the user's own.
  const { error } = await supabase
    .from("document_notes")
    .insert({ evidence_id: parsed.data.evidenceId, page: parsed.data.page, note: parsed.data.note });
  return error ? { ok: false, error: "The note could not be saved." } : { ok: true };
}

export async function deleteDocumentNote(id: string): Promise<ActionResult> {
  if (!(await currentUserId())) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("document_notes").delete().eq("id", id).select("id");
  return error || !data?.length ? { ok: false, error: "The note could not be removed." } : { ok: true };
}
