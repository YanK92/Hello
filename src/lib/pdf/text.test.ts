import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { renderTextPdf, toWinAnsi, wrapText } from "./text";

describe("toWinAnsi", () => {
  it("keeps text the standard PDF fonts can draw, including £ and curly quotes", () => {
    expect(toWinAnsi("“Hello” – £20 ‘ok’…")).toBe("“Hello” – £20 ‘ok’…");
  });

  it("replaces characters the standard fonts cannot draw", () => {
    expect(toWinAnsi("Car 🚗 ok → done")).toBe("Car ? ok ? done");
    expect(toWinAnsi("tab\there")).toBe("tab    here");
  });
});

describe("wrapText", () => {
  const width = (s: string) => s.length; // 1 unit per character

  it("wraps on spaces within the width", () => {
    expect(wrapText("the quick brown fox", 10, width)).toEqual(["the quick", "brown fox"]);
  });

  it("keeps blank lines and breaks over-long words", () => {
    expect(wrapText("a\n\nabcdefghijkl", 5, width)).toEqual(["a", "", "abcde", "fghij", "kl"]);
  });
});

describe("renderTextPdf", () => {
  it("produces a PDF, adding pages as needed, with a title", async () => {
    const short = await renderTextPdf({ title: "Letter", body: "Hello" });
    const long = await renderTextPdf({ title: "Letter", body: Array(300).fill("A line of text.").join("\n") });
    expect(new TextDecoder().decode(short.slice(0, 5))).toBe("%PDF-");
    expect((await PDFDocument.load(short)).getPageCount()).toBe(1);
    expect((await PDFDocument.load(long)).getPageCount()).toBeGreaterThan(1);
    expect((await PDFDocument.load(short)).getTitle()).toBe("Letter");
  });
});
