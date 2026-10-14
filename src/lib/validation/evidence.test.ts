import { describe, expect, it } from "vitest";
import { locationColumns, registerEvidenceSchema, startCaseSchema, titleFromItem } from "./evidence";

const now = () => new Date().toISOString();

describe("startCaseSchema", () => {
  it("accepts the minimum a user can enter in the wizard", () => {
    const r = startCaseSchema.safeParse({
      item: "Ford Focus AB19 CDE",
      whatHappened: "Engine warning light, car lost power on the A40.",
      occurredAt: now(),
      location: null,
    });
    expect(r.success).toBe(true);
  });

  it("rejects a time in the future", () => {
    const r = startCaseSchema.safeParse({
      item: "x",
      whatHappened: "y",
      occurredAt: new Date(Date.now() + 3_600_000).toISOString(),
      location: null,
    });
    expect(r.success).toBe(false);
  });

  it("rejects out-of-range coordinates and blank manual locations", () => {
    const base = { item: "x", whatHappened: "y", occurredAt: now() };
    expect(
      startCaseSchema.safeParse({ ...base, location: { source: "device", lat: 91, lng: 0, accuracy: 5 } })
        .success,
    ).toBe(false);
    expect(
      startCaseSchema.safeParse({ ...base, location: { source: "manual", label: "  " } }).success,
    ).toBe(false);
  });
});

describe("locationColumns", () => {
  it("maps device and manual locations to event columns", () => {
    expect(locationColumns({ source: "device", lat: 51.7, lng: -1.5, accuracy: 12 })).toMatchObject({
      lat: 51.7,
      lng: -1.5,
      location_accuracy_m: 12,
      location_source: "device",
      location_label: null,
    });
    expect(locationColumns({ source: "manual", label: "Home" })).toMatchObject({
      lat: null,
      location_label: "Home",
      location_source: "manual",
    });
    expect(locationColumns(null).location_source).toBeNull();
  });
});

describe("registerEvidenceSchema", () => {
  it("requires a well-formed SHA-256", () => {
    const base = {
      caseId: "11111111-1111-4111-8111-111111111111",
      eventId: null,
      storagePath: "a/b/c.jpg",
      originalName: "c.jpg",
    };
    expect(registerEvidenceSchema.safeParse({ ...base, sha256: "a".repeat(64) }).success).toBe(true);
    expect(registerEvidenceSchema.safeParse({ ...base, sha256: "xyz" }).success).toBe(false);
  });
});

describe("titleFromItem", () => {
  it("uses the first line, shortened to 80 characters", () => {
    expect(titleFromItem("  Sofa\nbought March  ")).toBe("Sofa");
    const long = "a".repeat(100);
    expect(titleFromItem(long)).toHaveLength(80);
    expect(titleFromItem(long).endsWith("…")).toBe(true);
  });
});
