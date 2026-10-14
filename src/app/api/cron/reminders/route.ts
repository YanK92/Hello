import { NextResponse, type NextRequest } from "next/server";
import { processDueReminders, sendWithResend, type DueReminder } from "@/lib/reminders/reminders";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sends due SAR reminder emails. Called daily by Vercel Cron (vercel.json),
 * which sends "Authorization: Bearer $CRON_SECRET".
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const admin = createAdminClient();
  const result = await processDueReminders({
    baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin,
    async due() {
      const { data, error } = await admin
        .from("reminders")
        .select("id, kind, user_id, case_id, cases(title), sar_requests(recipient, due_on, status)")
        .is("sent_at", null)
        .not("sar_request_id", "is", null)
        .lte("due_at", new Date().toISOString())
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((r) => {
        const sar = (Array.isArray(r.sar_requests) ? r.sar_requests[0] : r.sar_requests) as
          | { recipient: string; due_on: string | null; status: string }
          | null;
        const c = (Array.isArray(r.cases) ? r.cases[0] : r.cases) as { title: string } | null;
        return {
          id: r.id,
          kind: r.kind,
          userId: r.user_id,
          caseId: r.case_id,
          caseTitle: c?.title ?? "Your case",
          recipient: sar?.recipient ?? "the organisation",
          dueOn: sar?.due_on ?? "",
          sarStatus: sar?.status ?? "closed",
        } satisfies DueReminder;
      });
    },
    async contact(userId) {
      const [{ data: profile }, { data: user }] = await Promise.all([
        admin.from("profiles").select("email_reminders_opt_in").eq("id", userId).maybeSingle(),
        admin.auth.admin.getUserById(userId),
      ]);
      return { email: user?.user?.email ?? null, optedIn: Boolean(profile?.email_reminders_opt_in) };
    },
    send: sendWithResend,
    async markSent(id) {
      await admin.from("reminders").update({ sent_at: new Date().toISOString() }).eq("id", id);
    },
  });

  return NextResponse.json(result);
}
