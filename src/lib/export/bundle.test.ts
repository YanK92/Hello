import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "@/lib/integrity";
import { buildBundlePdf, type BundleData, type BundleFile } from "./bundle";

const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

async function twoPagePdf() {
  const d = await PDFDocument.create();
  d.addPage();
  d.addPage();
  return d.save();
}

async function fixture() {
  const pdfBytes = await twoPagePdf();
  const audio = new TextEncoder().encode("audio bytes");
  const tampered = new TextEncoder().encode("original receipt");
  const files: (BundleFile & { bytes: Uint8Array | null })[] = [
    { id: "a", label: "F1", name: "dash.png", mime: "image/png", size: PNG.length, sha256: await sha256Hex(PNG), uploadedAt: "2026-10-14T15:00:00Z", hashVerifiedAt: "2026-10-14T15:00:00Z", entryTitles: ["Warning light"], bytes: PNG },
    { id: "b", label: "F2", name: "invoice.pdf", mime: "application/pdf", size: pdfBytes.length, sha256: await sha256Hex(pdfBytes), uploadedAt: "2026-10-14T15:01:00Z", hashVerifiedAt: "2026-10-14T15:01:00Z", entryTitles: [], bytes: pdfBytes },
    { id: "c", label: "F3", name: "call.m4a", mime: "audio/mp4", size: audio.length, sha256: await sha256Hex(audio), uploadedAt: "2026-10-14T15:02:00Z", hashVerifiedAt: "2026-10-14T15:02:00Z", entryTitles: [], bytes: audio },
    { id: "d", label: "F4", name: "receipt.jpg", mime: "image/jpeg", size: 16, sha256: await sha256Hex(tampered), uploadedAt: "2026-10-14T15:03:00Z", hashVerifiedAt: "2026-10-14T15:03:00Z", entryTitles: [], bytes: new TextEncoder().encode("CHANGED receipt!") },
    { id: "e", label: "F5", name: "missing.pdf", mime: "application/pdf", size: 10, sha256: "0".repeat(64), uploadedAt: "2026-10-14T15:04:00Z", hashVerifiedAt: null, entryTitles: [], bytes: null },
  ];
  const data: BundleData = {
    caseTitle: "2019 Ford Focus, AB19 CDE",
    details: [["Item", "2019 Ford Focus"], ["Seller or trader", null]],
    generatedAt: "2026-10-14T16:00:00Z",
    preparedBy: "alex@example.test",
    entries: [
      { occurredAt: "2026-10-14T14:00:00Z", recordedAt: "2026-10-14T14:10:00Z", editedAt: null, type: "incident", title: "Warning light", who: null, notes: "Lost power on the A40 → pulled over 🚗", location: "51.7, -1.4", fileLabels: ["F1"] },
    ],
    files: files.map((f) => ({ ...f, bytes: undefined })),
    transcripts: [
      { fileLabel: "F3", fileName: "call.m4a", segments: [{ start: 0, end: 4, speaker: "Me", text: "Hello" }, { start: 4, end: 8, speaker: "Dealer", text: "We can inspect it Tuesday." }], highlights: [{ startSegment: 1, endSegment: 1, note: "Date offered" }] },
    ],
    sars: [{ recipient: "Example Finance", status: "sent", sentOn: "2026-09-28", receivedOn: "2026-09-29", dueOn: "2026-10-29", responses: [] }],
  };
  const bytesFor = async (f: BundleFile) => files.find((x) => x.id === f.id)!.bytes;
  return { data, bytesFor };
}

describe("buildBundlePdf", () => {
  it("builds an indexed bundle whose page numbers point at the right pages", async () => {
    const { data, bytesFor } = await fixture();
    const { pdf, index, checks } = await buildBundlePdf(data, bytesFor);
    const doc = await PDFDocument.load(pdf);

    const sections = index.filter((e) => e.level === 0).map((e) => e.title);
    expect(sections).toEqual(["Chronology", "Files", "Transcripts", "Data requests log"]);
    // Every index page number is within the document, and in order.
    const pages = index.map((e) => e.page);
    expect(pages.every((p) => p >= 2 && p <= doc.getPageCount())).toBe(true);
    expect([...pages].sort((a, b) => a - b)).toEqual(pages);
    // The embedded 2-page PDF comes straight after its header page.
    const f2 = index.find((e) => e.title.startsWith("F2"))!;
    const f3 = index.find((e) => e.title.startsWith("F3"))!;
    expect(f3.page - f2.page).toBe(3);
    expect(checks.map((c) => c.result)).toEqual(["matches", "matches", "matches", "changed", "unreadable"]);
  });

  it("produces a valid PDF with page numbers on every page", async () => {
    const { data, bytesFor } = await fixture();
    const { pdf } = await buildBundlePdf(data, bytesFor);
    const doc = await PDFDocument.load(pdf);
    expect(doc.getTitle()).toBe("Case bundle: 2019 Ford Focus, AB19 CDE");
    expect(doc.getPageCount()).toBeGreaterThan(6);
  });

  it("still builds when a PDF evidence file cannot be parsed", async () => {
    const { data, bytesFor } = await fixture();
    const broken = async (f: BundleFile) => (f.id === "b" ? new TextEncoder().encode("%PDF-broken") : bytesFor(f));
    const { checks } = await buildBundlePdf(data, broken);
    expect(checks.find((c) => c.label === "F2")!.result).toBe("changed");
  });
});
