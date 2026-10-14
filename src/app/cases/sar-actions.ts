"use server";

import { hasPaidAccess, PAID_FEATURE_MESSAGE } from "@/lib/payments/access";
import { sarReminderSchedule, ukTimeOn } from "@/lib/reminders/reminders";
import { sarDueDates, todayInUk } from "@/lib/sar/dates";
import { letterInput, markSentSchema, responseSchema, sarFormSchema } from "@/lib/sar/form";
import { buildSarLetter } from "@/lib/sar/letter";
import { createClient, currentUserId } from "@/lib/supabase/server";
import type { ActionResult } from "./evidence-actions";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Recipient name shortened to fit in a 200-character entry title. */
function short(name: string) {
  return name.length > 120 ? `${name.slice(0, 119)}…` : name;
}

function firstIssue(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Check the details and try again.";
}

/** Saves (or updates) a draft request, generating the letter text. */
export async function saveSarDraft(
  caseId: string,
  input: unknown,
  sarId?: string,
): Promise<ActionResult<{ sarId: string }>> {
  const parsed = sarFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (!(await currentUserId())) return { ok: false, error: "Please sign in again." };
  if (!(await hasPaidAccess())) return { ok: false, error: PAID_FEATURE_MESSAGE };
  const form = parsed.data;
  const supabase = await createClient();

  let contactId = form.recipient.contactId;
  if (form.recipient.save && !contactId) {
    const { data } = await supabase
      .from("contacts")
      .insert({
        name: form.recipient.name,
        address: form.recipient.address || null,
        email: form.recipient.email || null,
      })
      .select("id")
      .single();
    contactId = data?.id ?? null;
  }

  const letter = buildSarLetter(letterInput(form, todayInUk()));
  const row = {
    case_id: caseId,
    contact_id: contactId,
    recipient: form.recipient.name,
    recipient_address: form.recipient.address || null,
    recipient_email: form.recipient.email || null,
    items_selected: form.categories,
    date_from: form.dateFrom,
    date_to: form.dateTo,
    response_format: form.format,
    requester: form.requester,
    letter_text: letter.body,
  };

  const query = sarId
    ? supabase.from("sar_requests").update(row).eq("id", sarId).eq("status", "draft")
    : supabase.from("sar_requests").insert(row);
  const { data, error } = await query.select("id").single();
  if (error || !data) return { ok: false, error: "The request could not be saved. Please try again." };
  return { ok: true, sarId: data.id };
}

async function replaceReminders(supabase: Client, sar: { id: string; case_id: string }, dueOn: string | null) {
  await supabase.from("reminders").delete().eq("sar_request_id", sar.id).is("sent_at", null);
  if (!dueOn) return;
  const now = Date.now();
  const rows = sarReminderSchedule(dueOn)
    .filter((r) => new Date(r.dueAt).getTime() > now)
    .map((r) => ({ case_id: sar.case_id, sar_request_id: sar.id, kind: r.kind, due_at: r.dueAt }));
  if (rows.length) await supabase.from("reminders").insert(rows);
}

/** Records when (and how) the user sent the request, and works out the due dates. */
export async function markSarSent(sarId: string, input: unknown): Promise<ActionResult> {
  const parsed = markSentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { sentOn, receivedOn, method } = parsed.data;
  const today = todayInUk();
  if (sentOn > today || (receivedOn && receivedOn > today)) return { ok: false, error: "Dates cannot be in the future." };
  if (!(await currentUserId())) return { ok: false, error: "Please sign in again." };
  if (!(await hasPaidAccess())) return { ok: false, error: PAID_FEATURE_MESSAGE };

  const supabase = await createClient();
  const { data: sar } = await supabase
    .from("sar_requests")
    .select("id, case_id, recipient, status, event_id")
    .eq("id", sarId)
    .maybeSingle();
  if (!sar) return { ok: false, error: "Request not found." };

  const { dueOn } = sarDueDates({ sentOn, receivedOn });
  const { error } = await supabase
    .from("sar_requests")
    .update({
      sent_on: sentOn,
      received_on: receivedOn,
      sent_method: method,
      due_on: dueOn,
      status: sar.status === "draft" ? "sent" : sar.status,
    })
    .eq("id", sar.id);
  if (error) return { ok: false, error: "The dates could not be saved." };

  // Put the sending on the timeline (once), dated the day it was sent.
  const entry = {
    type: "communication",
    title: `Subject access request sent to ${short(sar.recipient)}`,
    occurred_at: ukTimeOn(sentOn, 12),
    notes: `Sent by ${method.replace("_", " ")}.${receivedOn ? ` Received by the organisation on ${receivedOn}.` : ""}`,
  };
  if (sar.event_id) {
    await supabase.from("events").update(entry).eq("id", sar.event_id);
  } else {
    const { data: ev } = await supabase.from("events").insert({ ...entry, case_id: sar.case_id }).select("id").single();
    if (ev) await supabase.from("sar_requests").update({ event_id: ev.id }).eq("id", sar.id);
  }

  if (sar.status === "draft" || sar.status === "sent") await replaceReminders(supabase, sar, dueOn);
  return { ok: true };
}

/** Logs what arrived and when. Returns the timeline entry to attach files to. */
export async function logSarResponse(sarId: string, input: unknown): Promise<ActionResult<{ eventId: string }>> {
  const parsed = responseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (parsed.data.receivedOn > todayInUk()) return { ok: false, error: "The date cannot be in the future." };
  if (!(await currentUserId())) return { ok: false, error: "Please sign in again." };
  if (!(await hasPaidAccess())) return { ok: false, error: PAID_FEATURE_MESSAGE };

  const supabase = await createClient();
  const { data: sar } = await supabase.from("sar_requests").select("id, case_id, recipient").eq("id", sarId).maybeSingle();
  if (!sar) return { ok: false, error: "Request not found." };

  const { data: ev, error: evError } = await supabase
    .from("events")
    .insert({
      case_id: sar.case_id,
      type: "document",
      title: `Response to subject access request received from ${short(sar.recipient)}`,
      occurred_at: ukTimeOn(parsed.data.receivedOn, 12),
      notes: parsed.data.description || null,
    })
    .select("id")
    .single();
  if (evError || !ev) return { ok: false, error: "The response could not be saved." };

  const { error } = await supabase.from("sar_responses").insert({
    sar_request_id: sar.id,
    received_on: parsed.data.receivedOn,
    description: parsed.data.description || null,
    event_id: ev.id,
  });
  if (error) return { ok: false, error: "The response could not be saved." };

  await supabase.from("sar_requests").update({ status: "response_received" }).eq("id", sar.id);
  await replaceReminders(supabase, sar, null);
  return { ok: true, eventId: ev.id };
}

export async function setSarStatus(sarId: string, status: "sent" | "response_received" | "closed"): Promise<ActionResult> {
  if (!(await currentUserId())) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sar_requests")
    .update({ status })
    .eq("id", sarId)
    .neq("status", "draft")
    .select("id, case_id, due_on");
  if (error || !data?.length) return { ok: false, error: "The status could not be changed." };
  await replaceReminders(supabase, data[0], status === "sent" ? data[0].due_on : null);
  return { ok: true };
}

export async function deleteSarDraft(sarId: string): Promise<ActionResult> {
  if (!(await currentUserId())) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("sar_requests").delete().eq("id", sarId).eq("status", "draft").select("id");
  return error || !data?.length ? { ok: false, error: "Only drafts can be deleted." } : { ok: true };
}

export async function setEmailReminders(on: boolean): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ email_reminders_opt_in: on }).eq("id", userId);
  return error ? { ok: false, error: "That setting could not be saved." } : { ok: true };
}
