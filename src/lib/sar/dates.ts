// Subject access request time limits, calculated the way the ICO describes:
// from the day the organisation receives the request to the corresponding
// calendar date in the next month, or the last day of that month if there is
// no corresponding date. An extension runs to three months from the same day.
// https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/right-of-access/what-should-we-consider-when-responding-to-a-request/

import { dayNumber, londonDate } from "@/lib/dates";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parse(date: string) {
  const m = date.match(ISO_DATE);
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${date}`);
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`Not a real date: ${date}`);
  }
  return { year, month, day };
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function format(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addCalendarMonths(date: string, months: number): string {
  const { year, month, day } = parse(date);
  const index = year * 12 + (month - 1) + months;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return format(y, m, Math.min(day, daysInMonth(y, m)));
}

export interface SarDates {
  /** The day the clock starts: when the organisation received the request. */
  startsOn: string;
  dueOn: string;
  /** Latest date if the organisation extends for a complex request. */
  extendedDueOn: string;
}

export function sarDueDates({ sentOn, receivedOn }: { sentOn: string; receivedOn: string | null }): SarDates {
  const startsOn = receivedOn ?? sentOn;
  return {
    startsOn,
    dueOn: addCalendarMonths(startsOn, 1),
    extendedDueOn: addCalendarMonths(startsOn, 3),
  };
}

/** Calendar days from today (UK) to a YYYY-MM-DD date. Negative once passed. */
export function daysUntil(date: string, now: Date = new Date()): number {
  return dayNumber(parse(date)) - dayNumber(londonDate(now));
}

export function todayInUk(now: Date = new Date()): string {
  const { year, month, day } = londonDate(now);
  return format(year, month, day);
}
