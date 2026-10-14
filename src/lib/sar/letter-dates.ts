// Small date helpers shared by letters and reminders (YYYY-MM-DD strings).

const longDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function formatLongDate(date: string): string {
  return longDate.format(new Date(`${date}T00:00:00Z`));
}

export function addDays(date: string, days: number): string {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}
