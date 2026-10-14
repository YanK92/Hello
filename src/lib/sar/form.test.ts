import { describe, expect, it } from "vitest";
import { buildSarLetter } from "./letter";
import { letterInput, markSentSchema, sarFormSchema } from "./form";

const valid = {
  recipient: { name: "Example Finance", address: "1 High St", email: "dpo@example.test" },
  categories: ["all"],
  format: "electronic",
  requester: { fullName: "Alex Taylor", email: "alex@example.test", references: [{ label: "Agreement", value: "" }] },
};

describe("sarFormSchema", () => {
  it("accepts a minimal request and fills defaults", () => {
    const r = sarFormSchema.parse(valid);
    expect(r.dateFrom).toBeNull();
    expect(r.recipient.save).toBe(false);
  });

  it("needs at least one category and a recipient", () => {
    expect(sarFormSchema.safeParse({ ...valid, categories: [] }).success).toBe(false);
    expect(sarFormSchema.safeParse({ ...valid, recipient: { name: " " } }).success).toBe(false);
  });

  it("needs an email for electronic copies and an address for paper ones", () => {
    expect(sarFormSchema.safeParse({ ...valid, requester: { fullName: "A" } }).success).toBe(false);
    expect(sarFormSchema.safeParse({ ...valid, format: "paper", requester: { fullName: "A" } }).success).toBe(false);
    expect(sarFormSchema.safeParse({ ...valid, format: "paper", requester: { fullName: "A", address: "x" } }).success).toBe(true);
  });

  it("rejects a date range that ends before it starts", () => {
    expect(sarFormSchema.safeParse({ ...valid, dateFrom: "2026-05-01", dateTo: "2026-04-01" }).success).toBe(false);
  });

  it("drops empty reference rows from the letter", () => {
    const letter = buildSarLetter(letterInput(sarFormSchema.parse(valid), "2026-10-14")).body;
    expect(letter).not.toContain("Agreement:");
  });
});

describe("markSentSchema", () => {
  it("rejects a received date before the sent date", () => {
    expect(markSentSchema.safeParse({ sentOn: "2026-05-02", receivedOn: "2026-05-01", method: "post" }).success).toBe(false);
    expect(markSentSchema.safeParse({ sentOn: "2026-05-02", receivedOn: "", method: "email" }).success).toBe(true);
  });
});
