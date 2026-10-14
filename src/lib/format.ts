const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});

const dateTimeSeconds = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Europe/London",
});

/** "14 Oct 2026, 16:21" in UK time. */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

/** With seconds, for server timestamps shown as a record. */
export function formatTimestamp(iso: string): string {
  return `${dateTimeSeconds.format(new Date(iso))} UK time`;
}

/** Value for <input type="datetime-local"> in the device's local time. */
export function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
