import "server-only";
import type { EvidenceItem } from "@/components/evidence/evidence-list";
import { sarDueDates } from "@/lib/sar/dates";
import type { SarForm } from "@/lib/sar/form";
import type { SarCategory } from "@/lib/sar/letter";
import { createClient } from "@/lib/supabase/server";

export type SarStatus = "draft" | "sent" | "response_received" | "closed";

export interface SarSummary {
  id: string;
  recipient: string;
  status: SarStatus;
  sentOn: string | null;
  receivedOn: string | null;
  dueOn: string | null;
  extendedDueOn: string | null;
  createdAt: string;
  responseCount: number;
}

export interface SarResponse {
  id: string;
  receivedOn: string;
  description: string | null;
  eventId: string | null;
  files: EvidenceItem[];
}

export interface SarDetail extends SarSummary {
  recipientEmail: string | null;
  recipientAddress: string | null;
  sentMethod: string | null;
  categories: SarCategory[];
  dateFrom: string | null;
  dateTo: string | null;
  format: "electronic" | "paper";
  requester: SarForm["requester"];
  letterText: string;
  responses: SarResponse[];
}

export interface Contact {
  id: string;
  name: string;
  address: string | null;
  email: string | null;
}

type Row = {
  id: string;
  recipient: string;
  status: SarStatus;
  sent_on: string | null;
  received_on: string | null;
  due_on: string | null;
  created_at: string;
};

function summary(r: Row, responseCount: number): SarSummary {
  const dates = r.sent_on ? sarDueDates({ sentOn: r.sent_on, receivedOn: r.received_on }) : null;
  return {
    id: r.id,
    recipient: r.recipient,
    status: r.status,
    sentOn: r.sent_on,
    receivedOn: r.received_on,
    dueOn: r.due_on ?? dates?.dueOn ?? null,
    extendedDueOn: dates?.extendedDueOn ?? null,
    createdAt: r.created_at,
    responseCount,
  };
}

export async function loadSars(caseId: string): Promise<SarSummary[]> {
  const supabase = await createClient();
  const [{ data }, { data: responses }] = await Promise.all([
    supabase
      .from("sar_requests")
      .select("id, recipient, status, sent_on, received_on, due_on, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
    supabase.from("sar_responses").select("sar_request_id").eq("case_id", caseId),
  ]);
  return (data ?? []).map((r) => summary(r, (responses ?? []).filter((x) => x.sar_request_id === r.id).length));
}

export async function loadSar(caseId: string, sarId: string): Promise<SarDetail | null> {
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("sar_requests")
    .select(
      "id, recipient, status, sent_on, received_on, due_on, created_at, recipient_email, recipient_address, sent_method, items_selected, date_from, date_to, response_format, requester, letter_text",
    )
    .eq("case_id", caseId)
    .eq("id", sarId)
    .maybeSingle();
  if (!r) return null;

  const { data: responses } = await supabase
    .from("sar_responses")
    .select("id, received_on, description, event_id")
    .eq("sar_request_id", r.id)
    .order("received_on");
  const eventIds = (responses ?? []).map((x) => x.event_id).filter(Boolean) as string[];
  const { data: files } = eventIds.length
    ? await supabase
        .from("evidence")
        .select("id, event_id, sha256, mime, size, original_name, uploaded_at, hash_verified_at, last_checked_at, last_check_ok")
        .in("event_id", eventIds)
    : { data: [] };

  return {
    ...summary(r, responses?.length ?? 0),
    recipientEmail: r.recipient_email,
    recipientAddress: r.recipient_address,
    sentMethod: r.sent_method,
    categories: r.items_selected as SarCategory[],
    dateFrom: r.date_from,
    dateTo: r.date_to,
    format: r.response_format,
    requester: r.requester,
    letterText: r.letter_text ?? "",
    responses: (responses ?? []).map((x) => ({
      id: x.id,
      receivedOn: x.received_on,
      description: x.description,
      eventId: x.event_id,
      files: (files ?? [])
        .filter((f) => f.event_id === x.event_id)
        .map((f) => ({
          id: f.id,
          name: f.original_name ?? "Untitled file",
          mime: f.mime,
          size: f.size,
          sha256: f.sha256,
          uploadedAt: f.uploaded_at,
          hashVerifiedAt: f.hash_verified_at,
          lastCheckedAt: f.last_checked_at,
          lastCheckOk: f.last_check_ok,
          thumbUrl: null,
        })),
    })),
  };
}

export async function loadContacts(): Promise<Contact[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("contacts").select("id, name, address, email").order("name");
  return data ?? [];
}

export async function emailRemindersOn(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("email_reminders_opt_in").eq("id", userId).maybeSingle();
  return Boolean(data?.email_reminders_opt_in);
}

export async function caseDefaults(caseId: string) {
  const supabase = await createClient();
  const [{ data: c }, { data: claims }] = await Promise.all([
    supabase.from("cases").select("agreement_reference, item_description").eq("id", caseId).maybeSingle(),
    supabase.auth.getClaims(),
  ]);
  return {
    email: (claims?.claims.email as string | undefined) ?? "",
    agreementReference: c?.agreement_reference ?? "",
    item: c?.item_description ?? "",
  };
}
