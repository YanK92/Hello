import { describe, expect, it } from "vitest";
import { parseNewCase } from "./case";

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("parseNewCase", () => {
  it("accepts a title on its own and nulls the optional fields", () => {
    const result = parseNewCase(form({ title: "  Car gearbox  " }));
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      title: "Car gearbox",
      item_description: null,
      trader_name: null,
      finance_provider: null,
      agreement_reference: null,
    });
  });

  it("turns blank optional fields into null", () => {
    const result = parseNewCase(form({ title: "Sofa", trader_name: "   " }));
    expect(result.data?.trader_name).toBeNull();
  });

  it("rejects a missing or blank title", () => {
    expect(parseNewCase(form({})).success).toBe(false);
    expect(parseNewCase(form({ title: "   " })).success).toBe(false);
  });

  it("rejects over-long fields to match the database limits", () => {
    expect(parseNewCase(form({ title: "x".repeat(201) })).success).toBe(false);
    expect(parseNewCase(form({ title: "ok", trader_name: "x".repeat(201) })).success).toBe(false);
  });
});
