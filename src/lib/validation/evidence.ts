import { z } from "zod";
import { isSha256Hex } from "@/lib/integrity";

export const locationSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("device"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().min(0).nullable(),
  }),
  z.object({
    source: z.literal("manual"),
    label: z.string().trim().min(1, "Describe where you are.").max(300),
  }),
]);

export type LocationValue = z.infer<typeof locationSchema>;

/** Columns on public.events for a location (or none). */
export function locationColumns(loc: LocationValue | null) {
  if (!loc) return { lat: null, lng: null, location_accuracy_m: null, location_label: null, location_source: null };
  if (loc.source === "device") {
    return {
      lat: loc.lat,
      lng: loc.lng,
      location_accuracy_m: loc.accuracy,
      location_label: null,
      location_source: "device" as const,
    };
  }
  return { lat: null, lng: null, location_accuracy_m: null, location_label: loc.label, location_source: "manual" as const };
}

// Allow a little clock skew between the phone and the server.
const notInFuture = (iso: string) => new Date(iso).getTime() <= Date.now() + 5 * 60 * 1000;

export const startCaseSchema = z.object({
  item: z.string().trim().min(1, "Say what the item is.").max(2000),
  whatHappened: z.string().trim().min(1, "Say briefly what happened.").max(10000),
  occurredAt: z.iso.datetime({ offset: true }).refine(notInFuture, "The time cannot be in the future."),
  location: locationSchema.nullable(),
});

export type StartCaseInput = z.infer<typeof startCaseSchema>;

export const checkInSchema = z.object({
  caseId: z.uuid(),
  notes: z.string().trim().max(10000).optional().default(""),
  location: locationSchema,
});

export const registerEvidenceSchema = z.object({
  caseId: z.uuid(),
  eventId: z.uuid().nullable(),
  storagePath: z.string().min(1).max(300),
  sha256: z.string().refine(isSha256Hex, "Invalid file fingerprint."),
  originalName: z.string().trim().max(255),
});

/** Case title from the item description: first line, at most 80 characters. */
export function titleFromItem(item: string): string {
  const firstLine = item.trim().split("\n")[0].trim();
  return firstLine.length <= 80 ? firstLine : `${firstLine.slice(0, 79).trimEnd()}…`;
}
