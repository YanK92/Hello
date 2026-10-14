// SAR reminders: when to send them, what they say, and the send loop. The
// loop takes its I/O as arguments so it can be tested without a database or
// an email provider.

import { addDays, formatLongDate } from "@/lib/sar/letter-dates";

export type ReminderKind = "sar_due" | "sar_followup";

/** The UTC instant of hour:00 UK time on a YYYY-MM-DD date. */
export function ukTimeOn(date: string, hour: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour);
  const ukHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "numeric", hourCycle: "h23" }).format(guess),
  );
  return new Date(guess - (ukHour - hour) * 3_600_000).toISOString();
}

export const FOLLOWUP_DAYS = 7;

export function sarReminderSchedule(dueOn: string): { kind: ReminderKind; dueAt: string }[] {
  return [
    { kind: "sar_due", dueAt: ukTimeOn(dueOn, 8) },
    { kind: "sar_followup", dueAt: ukTimeOn(addDays(dueOn, FOLLOWUP_DAYS), 8) },
  ];
}

export interface DueReminder {
  id: string;
  kind: string;
  userId: string;
  caseId: string;
  caseTitle: string;
  recipient: string;
  dueOn: string;
  sarStatus: string;
}

export function reminderEmail(r: DueReminder, link: string): { subject: string; text: string } {
  const date = formatLongDate(r.dueOn);
  const first =
    r.kind === "sar_followup"
      ? `Today is ${FOLLOWUP_DAYS} days after the response date you recorded (${date}) for your subject access request to ${r.recipient}, and no response has been logged in Evidence Locker.`
      : `Today is the response date you recorded (${date}) for your subject access request to ${r.recipient}.`;
  return {
    subject: `Reminder: SAR response date for ${r.recipient}`,
    text: [
      first,
      "",
      `Case: ${r.caseTitle}`,
      `Open the case to log a response or update the dates: ${link}`,
      "",
      "For what the rules say about response times, see the ICO: https://ico.org.uk/for-the-public/getting-copies-of-your-information-subject-access-request/",
      "",
      "You are receiving this because you turned on email reminders in Evidence Locker. You can turn them off on the SAR page.",
    ].join("\n"),
  };
}

export interface ReminderDeps {
  due(): Promise<DueReminder[]>;
  contact(userId: string): Promise<{ email: string | null; optedIn: boolean }>;
  send(to: string, subject: string, text: string): Promise<void>;
  markSent(id: string): Promise<void>;
  baseUrl: string;
}

export async function processDueReminders(deps: ReminderDeps) {
  const result = { sent: 0, skipped: 0, failed: 0 };
  for (const r of await deps.due()) {
    const settled = r.sarStatus === "response_received" || r.sarStatus === "closed";
    const who = settled ? null : await deps.contact(r.userId);
    if (!who?.optedIn || !who.email) {
      // Nothing to send: settle it so it is not picked up again.
      await deps.markSent(r.id);
      result.skipped++;
      continue;
    }
    const { subject, text } = reminderEmail(r, `${deps.baseUrl}/cases/${r.caseId}/sar`);
    try {
      await deps.send(who.email, subject, text);
      await deps.markSent(r.id);
      result.sent++;
    } catch {
      result.failed++;
    }
  }
  return result;
}

/** Sends one email through Resend's HTTP API. */
export async function sendWithResend(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL;
  if (!key || !from) throw new Error("RESEND_API_KEY and REMINDER_FROM_EMAIL must be set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}`);
}
