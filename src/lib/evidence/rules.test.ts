import { describe, expect, it } from "vitest";
import { evidencePath, formatBytes, pathBelongsTo, rejectReason, sourceForMime } from "./rules";

const USER = "00000000-0000-4000-8000-00000000000a";
const CASE = "11111111-1111-4111-8111-111111111111";
const FILE = "22222222-2222-4222-8222-222222222222";

describe("rejectReason", () => {
  it("accepts photos and PDFs within the size limit", () => {
    expect(rejectReason({ type: "image/jpeg", size: 2_000_000 })).toBeNull();
    expect(rejectReason({ type: "application/pdf", size: 10 })).toBeNull();
  });

  it("rejects other types, empty files and oversized files", () => {
    expect(rejectReason({ type: "application/x-msdownload", size: 10 })).toMatch(/only photos/i);
    expect(rejectReason({ type: "image/jpeg", size: 0 })).toMatch(/empty/i);
    expect(rejectReason({ type: "image/jpeg", size: 25 * 1024 * 1024 + 1 })).toMatch(/25 MB/);
  });
});

describe("evidence paths", () => {
  it("puts files under the user's folder with a random name", () => {
    expect(evidencePath(USER, CASE, FILE, "image/jpeg")).toBe(`${USER}/${CASE}/${FILE}.jpg`);
  });

  it("accepts only paths in this user's case folder", () => {
    const good = evidencePath(USER, CASE, FILE, "application/pdf");
    expect(pathBelongsTo(good, USER, CASE)).toBe(true);
    expect(pathBelongsTo(good, "00000000-0000-4000-8000-00000000000b", CASE)).toBe(false);
    expect(pathBelongsTo(`${USER}/${CASE}/../other/${FILE}.jpg`, USER, CASE)).toBe(false);
    expect(pathBelongsTo(`${USER}/${CASE}/nested/${FILE}.jpg`, USER, CASE)).toBe(false);
  });
});

describe("helpers", () => {
  it("maps types to sources", () => {
    expect(sourceForMime("image/png")).toBe("photo");
    expect(sourceForMime("application/pdf")).toBe("doc");
  });

  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3.5 * 1024 * 1024)).toBe("3.5 MB");
  });
});
