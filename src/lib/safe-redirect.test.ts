import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("keeps relative paths", () => {
    expect(safeNextPath("/cases/123")).toBe("/cases/123");
  });

  it.each([null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "cases"])(
    "falls back for %s",
    (next) => {
      expect(safeNextPath(next)).toBe("/cases");
    },
  );
});
