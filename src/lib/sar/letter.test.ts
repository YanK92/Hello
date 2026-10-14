import { describe, expect, it } from "vitest";
import { findBannedPhrases, loadPhrases } from "../../../scripts/copy-lint.mjs";
import { buildSarLetter, mailtoLink, SAR_CATEGORIES, type SarLetterInput } from "./letter";

const input: SarLetterInput = {
  date: "2026-10-14",
  recipient: { name: "Example Finance Ltd, Data Protection Officer", address: "1 High Street\nLeeds\nLS1 1AA", email: "dpo@example.test" },
  categories: ["calls", "account"],
  dateRange: { from: "2026-09-01", to: null },
  format: "electronic",
  requester: {
    fullName: "Alex Taylor",
    address: "2 Low Road\nYork\nYO1 1BB",
    email: "alex@example.test",
    phone: "",
    references: [{ label: "Agreement number", value: "AG-12345" }, { label: "Vehicle registration", value: "AB19 CDE" }],
    other: "",
  },
};

describe("buildSarLetter", () => {
  const { subject, body } = buildSarLetter(input);

  it("names the request and the law it is made under", () => {
    expect(subject).toBe("Subject access request: Alex Taylor");
    expect(body).toContain("I am making a subject access request under Article 15 of the UK General Data Protection Regulation.");
  });

  it("lists only the categories the user ticked, plus the date range", () => {
    expect(body).toContain(`- ${SAR_CATEGORIES.calls}`);
    expect(body).toContain(`- ${SAR_CATEGORIES.account}`);
    expect(body).not.toContain(SAR_CATEGORIES.credit);
    expect(body).toContain("covering the period from 1 September 2026 onwards");
  });

  it("includes identifying details and leaves out blank ones", () => {
    expect(body).toContain("Agreement number: AG-12345");
    expect(body).toContain("Vehicle registration: AB19 CDE");
    expect(body).not.toMatch(/^Phone:/m);
  });

  it("states the chosen format and signs off with the user's name", () => {
    expect(body).toContain("by email to alex@example.test");
    expect(body.trimEnd().endsWith("Yours faithfully,\nAlex Taylor")).toBe(true);
  });

  it("dates the letter in UK long form", () => {
    expect(body).toContain("14 October 2026");
  });

  it("contains no advice, outcome or labelling language", () => {
    const all = Object.values(SAR_CATEGORIES).join("\n");
    expect(findBannedPhrases(`${body}\n${all}`, loadPhrases())).toEqual([]);
  });

  it("asks for paper copies when chosen", () => {
    expect(buildSarLetter({ ...input, format: "paper" }).body).toContain("as paper copies by post to the address above");
  });
});

describe("mailtoLink", () => {
  it("encodes the recipient, subject and body", () => {
    const link = mailtoLink("dpo@example.test", "Subject access request: A & B", "Line 1\nLine 2");
    expect(link).toBe("mailto:dpo@example.test?subject=Subject%20access%20request%3A%20A%20%26%20B&body=Line%201%0D%0ALine%202");
  });
});
