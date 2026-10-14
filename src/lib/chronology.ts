import { z } from "zod";

/** Entry types the user can pick. Labels are neutral descriptions only. */
export const ENTRY_TYPES = {
  incident: "What happened",
  check_in: "Check-in",
  communication: "Call, email or letter",
  repair: "Inspection or repair",
  payment: "Payment",
  document: "Document received",
  note: "Note",
} as const;

export type EntryType = keyof typeof ENTRY_TYPES;

export function entryTypeLabel(type: string): string {
  return (ENTRY_TYPES as Record<string, string>)[type] ?? type;
}

const notInFuture = (iso: string) => new Date(iso).getTime() <= Date.now() + 5 * 60 * 1000;

export const entrySchema = z.object({
  type: z.enum(Object.keys(ENTRY_TYPES) as [EntryType, ...EntryType[]]),
  title: z.string().trim().min(1, "Give the entry a short title.").max(200),
  occurredAt: z.iso.datetime({ offset: true }).refine(notInFuture, "The date cannot be in the future."),
  who: z.string().trim().max(200).optional().default(""),
  notes: z.string().trim().max(10000).optional().default(""),
  evidenceIds: z.array(z.uuid()).max(50).optional().default([]),
});

export type EntryInput = z.input<typeof entrySchema>;

/** The fields of an entry the timeline needs for filtering. */
export interface Filterable {
  type: string;
  title: string | null;
  who: string | null;
  notes: string | null;
  locationLabel: string | null;
  evidence: { name: string }[];
}

export interface TimelineFilter {
  types: string[]; // empty = all
  text: string;
  withFilesOnly: boolean;
}

export const EMPTY_FILTER: TimelineFilter = { types: [], text: "", withFilesOnly: false };

export function matchesFilter(entry: Filterable, filter: TimelineFilter): boolean {
  if (filter.types.length && !filter.types.includes(entry.type)) return false;
  if (filter.withFilesOnly && entry.evidence.length === 0) return false;
  const needle = filter.text.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [entry.title, entry.who, entry.notes, entry.locationLabel, ...entry.evidence.map((e) => e.name)]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return needle.split(/\s+/).every((word) => haystack.includes(word));
}
