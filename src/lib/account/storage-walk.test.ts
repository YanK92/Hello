import { describe, expect, it } from "vitest";
import { listAllPaths } from "./storage-walk";

describe("listAllPaths", () => {
  it("walks folders recursively and pages through long listings", async () => {
    const tree: Record<string, { name: string; id: string | null }[]> = {
      u: [
        { name: "case1", id: null },
        { name: "case2", id: null },
      ],
      "u/case1": [
        { name: "a.jpg", id: "1" },
        { name: "b.pdf", id: "2" },
        { name: "c.m4a", id: "3" },
      ],
      "u/case2": [],
    };
    const list = async (prefix: string, offset: number, limit: number) => (tree[prefix] ?? []).slice(offset, offset + limit);
    expect(await listAllPaths("u", list, 2)).toEqual(["u/case1/a.jpg", "u/case1/b.pdf", "u/case1/c.m4a"]);
  });
});
