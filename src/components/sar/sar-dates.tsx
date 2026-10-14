import { daysUntil } from "@/lib/sar/dates";
import { formatLongDate } from "@/lib/sar/letter-dates";

/** Neutral description of a recorded due date relative to today (UK). */
export function DueText({ dueOn, now }: { dueOn: string; now?: Date }) {
  const days = daysUntil(dueOn, now);
  const when =
    days > 1 ? `in ${days} days` : days === 1 ? "tomorrow" : days === 0 ? "today" : days === -1 ? "yesterday" : `${-days} days ago`;
  return (
    <span>
      {days >= 0 ? "Response due" : "Response date was"} {formatLongDate(dueOn)} ({when})
    </span>
  );
}

export const SAR_STATUS_LABELS = {
  draft: "Draft",
  sent: "Sent",
  response_received: "Response logged",
  closed: "Closed",
} as const;
