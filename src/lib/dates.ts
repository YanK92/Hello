// Calendar date maths in UK time. Counting is done on calendar dates, not
// elapsed hours, so clock changes never shift a count by a day.

export const UK_TIME_ZONE = "Europe/London";

export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number;
}

const londonParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: UK_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/** The calendar date in the UK at the given instant. */
export function londonDate(iso: string | Date): CalendarDate {
  const parts = londonParts.formatToParts(typeof iso === "string" ? new Date(iso) : iso);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Days since 1970-01-01 for a calendar date (time zone free). */
export function dayNumber({ year, month, day }: CalendarDate): number {
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/** Whole calendar days between two instants, as UK dates. Always >= 0. */
export function calendarDaysBetween(a: string | Date, b: string | Date): number {
  return Math.abs(dayNumber(londonDate(b)) - dayNumber(londonDate(a)));
}
