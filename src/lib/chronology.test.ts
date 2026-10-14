import { describe, expect, it } from "vitest";
import { EMPTY_FILTER, entrySchema, matchesFilter, type Filterable } from "./chronology";

const entry = (over: Partial<Filterable> = {}): Filterable => ({
  type: "communication",
  title: "Phoned the dealer",
  who: "Sam, service desk",
  notes: "Asked for the inspection report",
  locationLabel: null,
  evidence: [],
  ...over,
});

describe("matchesFilter", () => {
  it("matches everything with an empty filter", () => {
    expect(matchesFilter(entry(), EMPTY_FILTER)).toBe(true);
  });

  it("filters by type", () => {
    expect(matchesFilter(entry(), { ...EMPTY_FILTER, types: ["repair"] })).toBe(false);
    expect(matchesFilter(entry(), { ...EMPTY_FILTER, types: ["repair", "communication"] })).toBe(true);
  });

  it("searches title, who, notes and file names, all words, any case", () => {
    expect(matchesFilter(entry(), { ...EMPTY_FILTER, text: "SAM inspection" })).toBe(true);
    expect(matchesFilter(entry(), { ...EMPTY_FILTER, text: "sam refund" })).toBe(false);
    expect(
      matchesFilter(entry({ evidence: [{ name: "invoice-0042.pdf" }] }), { ...EMPTY_FILTER, text: "0042" }),
    ).toBe(true);
  });

  it("can show only entries with files", () => {
    expect(matchesFilter(entry(), { ...EMPTY_FILTER, withFilesOnly: true })).toBe(false);
    expect(matchesFilter(entry({ evidence: [{ name: "a.jpg" }] }), { ...EMPTY_FILTER, withFilesOnly: true })).toBe(true);
  });
});

describe("entrySchema", () => {
  const base = { type: "note", title: "Letter arrived", occurredAt: "2026-09-01T10:00:00+01:00" };

  it("accepts a minimal entry and defaults the optional parts", () => {
    const r = entrySchema.parse(base);
    expect(r).toMatchObject({ who: "", notes: "", evidenceIds: [] });
  });

  it("rejects unknown types, blank titles and future dates", () => {
    expect(entrySchema.safeParse({ ...base, type: "verdict" }).success).toBe(false);
    expect(entrySchema.safeParse({ ...base, title: "  " }).success).toBe(false);
    expect(
      entrySchema.safeParse({ ...base, occurredAt: new Date(Date.now() + 86_400_000).toISOString() }).success,
    ).toBe(false);
  });
});
