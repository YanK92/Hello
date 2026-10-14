import { describe, expect, it } from "vitest";
import { findBannedPhrases, loadPhrases } from "./copy-lint.mjs";

const phrases = loadPhrases();

describe("copy lint", () => {
  it("flags advice and outcome language, case-insensitively", () => {
    const hits = findBannedPhrases("Intro\nYou SHOULD reject the car.\nYou'll win this.", phrases);
    expect(hits).toEqual([
      { line: 2, phrase: "you should" },
      { line: 3, phrase: "you'll win" },
    ]);
  });

  it("treats curly apostrophes like straight ones", () => {
    expect(findBannedPhrases("you’ll win", phrases)).toHaveLength(1);
  });

  it("flags labels about firms", () => {
    expect(findBannedPhrases("The lender is sandbagging", phrases)).toHaveLength(1);
  });

  it("does not flag neutral wording or words that merely contain a phrase", () => {
    expect(
      findBannedPhrases("14 days between these entries. Unbiased record. Readmission form.", phrases),
    ).toEqual([]);
  });
});
