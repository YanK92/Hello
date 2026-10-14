"use server";

import { createClient, currentUserId } from "@/lib/supabase/server";
import { locationColumns, startCaseSchema, titleFromItem, type StartCaseInput } from "@/lib/validation/evidence";

export type StartCaseResult =
  | { ok: true; caseId: string; eventId: string; userId: string }
  | { ok: false; error: string };

/** Day-1 wizard: creates the case and its first entry in one go. */
export async function startCase(input: StartCaseInput): Promise<StartCaseResult> {
  const parsed = startCaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Please sign in again." };

  const { item, whatHappened, occurredAt, location } = parsed.data;
  const supabase = await createClient();

  const { data: c, error: caseError } = await supabase
    .from("cases")
    .insert({ title: titleFromItem(item), item_description: item })
    .select("id")
    .single();
  if (caseError || !c) return { ok: false, error: "The case could not be saved. Please try again." };

  const { data: e, error: eventError } = await supabase
    .from("events")
    .insert({
      case_id: c.id,
      type: "incident",
      occurred_at: occurredAt,
      notes: whatHappened,
      ...locationColumns(location),
    })
    .select("id")
    .single();
  if (eventError || !e) {
    return { ok: false, error: "The case was saved but the first entry was not. Add it from the case page." };
  }

  return { ok: true, caseId: c.id, eventId: e.id, userId };
}
