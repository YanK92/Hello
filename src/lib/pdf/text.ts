import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

// A4 in points.
export const PAGE = { width: 595.28, height: 841.89, margin: 56 };

// Characters outside Latin-1 that WinAnsi (the standard fonts' encoding) has.
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

/** Makes text drawable with the standard PDF fonts; unsupported characters become "?". */
export function toWinAnsi(text: string): string {
  return Array.from(text.replace(/\t/g, "    "))
    .map((ch) => {
      const code = ch.codePointAt(0)!;
      if (ch === "\n") return ch;
      if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(ch)) return ch;
      return "?";
    })
    .join("");
}

/** Wraps text to a width, keeping blank lines and splitting over-long words. */
export function wrapText(text: string, maxWidth: number, widthOf: (s: string) => number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/ +/)) {
      let w = word;
      while (widthOf(w) > maxWidth) {
        if (line) {
          out.push(line);
          line = "";
        }
        let cut = w.length - 1;
        while (cut > 1 && widthOf(w.slice(0, cut)) > maxWidth) cut--;
        out.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      const candidate = line ? `${line} ${w}` : w;
      if (widthOf(candidate) <= maxWidth) line = candidate;
      else {
        out.push(line);
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

export interface TextWriter {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  /** Writes wrapped text, starting new pages as needed. */
  write(text: string, opts?: { size?: number; bold?: boolean; gapAfter?: number; indent?: number }): void;
  newPage(): void;
  space(points: number): void;
  /** Current page number (1-based). */
  pageNumber(): number;
}

/** A simple flowing-text writer over pdf-lib, shared by letters and bundles. */
export async function createTextWriter(title: string): Promise<TextWriter> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setCreator("Evidence Locker");
  doc.setProducer("Evidence Locker");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;

  const writer: TextWriter = {
    doc,
    font,
    bold,
    newPage() {
      page = doc.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - PAGE.margin;
    },
    space(points) {
      y -= points;
      if (y < PAGE.margin) writer.newPage();
    },
    pageNumber() {
      return doc.getPageCount();
    },
    write(text, opts = {}) {
      const size = opts.size ?? 11;
      const f = opts.bold ? bold : font;
      const indent = opts.indent ?? 0;
      const lineHeight = size * 1.4;
      const maxWidth = PAGE.width - PAGE.margin * 2 - indent;
      for (const line of wrapText(toWinAnsi(text), maxWidth, (s) => f.widthOfTextAtSize(s, size))) {
        if (y - lineHeight < PAGE.margin) writer.newPage();
        y -= lineHeight;
        if (line) page.drawText(line, { x: PAGE.margin + indent, y, size, font: f, color: rgb(0.1, 0.1, 0.12) });
      }
      if (opts.gapAfter) writer.space(opts.gapAfter);
    },
  };
  return writer;
}

/** Adds "Page n of m" (and an optional label) to the foot of every page. */
export function addPageNumbers(doc: PDFDocument, font: PDFFont, label = "") {
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const text = toWinAnsi(`${label ? `${label} · ` : ""}Page ${i + 1} of ${pages.length}`);
    const size = 8;
    p.drawText(text, {
      x: PAGE.width - PAGE.margin - font.widthOfTextAtSize(text, size),
      y: PAGE.margin / 2,
      size,
      font,
      color: rgb(0.4, 0.4, 0.45),
    });
  });
}

export async function renderTextPdf({ title, body }: { title: string; body: string }): Promise<Uint8Array> {
  const w = await createTextWriter(title);
  w.write(body);
  addPageNumbers(w.doc, w.font);
  return w.doc.save();
}
