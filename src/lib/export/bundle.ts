// Case bundle PDF: cover, index, chronology, files (with images and PDFs
// reproduced and a fingerprint check at export time), transcripts with the
// user's own highlights, and the data requests log. Records only: nothing
// here summarises, weighs or interprets the content.

import { PDFDocument, type PDFImage } from "pdf-lib";
import { entryTypeLabel } from "@/lib/chronology";
import { formatBytes } from "@/lib/evidence/rules";
import { formatTimestamp } from "@/lib/format";
import { sha256Hex } from "@/lib/integrity";
import { addPageNumbers, createTextWriter, type TextWriter } from "@/lib/pdf/text";
import { formatLongDate } from "@/lib/sar/letter-dates";
import { formatTimecode, type Segment } from "@/lib/transcripts/parse";

export interface BundleFile {
  id: string;
  /** Short reference used throughout the bundle, e.g. "F3". */
  label: string;
  name: string;
  mime: string;
  size: number;
  sha256: string;
  uploadedAt: string;
  hashVerifiedAt: string | null;
  entryTitles: string[];
}

export interface BundleEntry {
  occurredAt: string;
  recordedAt: string;
  editedAt: string | null;
  type: string;
  title: string | null;
  who: string | null;
  notes: string | null;
  location: string | null;
  fileLabels: string[];
}

export interface BundleData {
  caseTitle: string;
  details: [string, string | null][];
  generatedAt: string;
  preparedBy: string | null;
  entries: BundleEntry[];
  files: BundleFile[];
  transcripts: {
    fileLabel: string;
    fileName: string;
    segments: Segment[];
    highlights: { startSegment: number; endSegment: number; note: string | null }[];
  }[];
  sars: {
    recipient: string;
    status: string;
    sentOn: string | null;
    receivedOn: string | null;
    dueOn: string | null;
    responses: { receivedOn: string; description: string | null }[];
  }[];
}

export interface IndexEntry {
  title: string;
  level: 0 | 1;
  page: number;
}

export type CheckResult = "matches" | "changed" | "unreadable";

export interface FileCheck {
  label: string;
  result: CheckResult;
  exportSha256: string | null;
}

const CHECK_TEXT: Record<CheckResult, string> = {
  matches: "Matches the fingerprint recorded at upload",
  changed: "DOES NOT MATCH the fingerprint recorded at upload",
  unreadable: "The stored file could not be read at export",
};

const SAR_STATUS: Record<string, string> = {
  draft: "Draft (not sent)",
  sent: "Sent",
  response_received: "Response logged",
  closed: "Closed",
};

/** File name used inside the ZIP of originals; the bundle refers to it. */
export function zipName(file: Pick<BundleFile, "label" | "name">): string {
  const safe = file.name.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 80) || "file";
  return `${file.label} ${safe}`;
}

async function embedImage(doc: PDFDocument, mime: string, bytes: Uint8Array): Promise<PDFImage | null> {
  try {
    if (mime === "image/jpeg") return await doc.embedJpg(bytes);
    if (mime === "image/png") return await doc.embedPng(bytes);
  } catch {
    // Unreadable image: fall through to a note.
  }
  return null;
}

async function writeContent(
  w: TextWriter,
  data: BundleData,
  bytesFor: (f: BundleFile) => Promise<Uint8Array | null>,
) {
  const marks: IndexEntry[] = [];
  const checks: FileCheck[] = [];
  const mark = (title: string, level: 0 | 1) => marks.push({ title, level, page: w.pageNumber() });

  // 1. Chronology
  mark("Chronology", 0);
  w.write("1. Chronology", { size: 16, bold: true, gapAfter: 4 });
  w.write("Entries as recorded by the account holder, in date order. Times are UK time.", { size: 9, gapAfter: 8 });
  if (!data.entries.length) w.write("No entries recorded.");
  for (const e of data.entries) {
    w.write(`${formatTimestamp(e.occurredAt)} · ${entryTypeLabel(e.type)}`, { size: 9, bold: true });
    if (e.title) w.write(e.title, { bold: true });
    if (e.who) w.write(`Who: ${e.who}`, { size: 10 });
    if (e.notes) w.write(e.notes, { size: 10 });
    if (e.location) w.write(`Location: ${e.location}`, { size: 10 });
    if (e.fileLabels.length) w.write(`Files: ${e.fileLabels.join(", ")}`, { size: 10 });
    w.write(
      `Recorded ${formatTimestamp(e.recordedAt)}${e.editedAt ? `; last edited ${formatTimestamp(e.editedAt)} (earlier versions kept)` : ""}`,
      { size: 8 },
    );
    w.rule();
  }

  // 2. Files
  w.freshPage();
  mark("Files", 0);
  w.write("2. Files", { size: 16, bold: true, gapAfter: 4 });
  w.write(
    "Each file was fingerprinted (SHA-256) when uploaded. At export, the stored file was fingerprinted again and compared. The originals are in the separate ZIP download, under the names shown.",
    { size: 9, gapAfter: 8 },
  );
  for (const [i, f] of data.files.entries()) {
    if (i > 0) w.freshPage();
    mark(`${f.label} ${f.name}`, 1);
    const bytes = await bytesFor(f);
    const exportSha = bytes ? await sha256Hex(bytes) : null;
    const result: CheckResult = !bytes ? "unreadable" : exportSha === f.sha256 ? "matches" : "changed";
    checks.push({ label: f.label, result, exportSha256: exportSha });

    w.write(`${f.label} · ${f.name}`, { size: 13, bold: true });
    w.write(`${f.mime} · ${formatBytes(f.size)} · uploaded ${formatTimestamp(f.uploadedAt)}`, { size: 9 });
    w.write(`SHA-256 at upload: ${f.sha256}`, { size: 8 });
    w.write(`SHA-256 at export: ${exportSha ?? "not available"}`, { size: 8 });
    w.write(`Check: ${CHECK_TEXT[result]}`, { size: 9, bold: true });
    if (f.entryTitles.length) w.write(`Linked entries: ${f.entryTitles.join("; ")}`, { size: 9 });
    w.write(`In the ZIP of originals as: ${zipName(f)}`, { size: 8, gapAfter: 8 });

    if (!bytes) continue;
    if (f.mime === "application/pdf") {
      try {
        const src = await PDFDocument.load(bytes, { ignoreEncryption: false });
        const pages = await w.doc.copyPages(src, src.getPageIndices());
        w.appendPages(pages);
      } catch {
        w.write("This PDF could not be reproduced here (it may be encrypted or damaged). See the original in the ZIP.", { size: 9 });
        // A PDF that will not parse cannot be shown; treat it like a failed check only if the hash also differs.
      }
      continue;
    }
    const img = await embedImage(w.doc, f.mime, bytes);
    if (img) w.image(img, 560);
    else w.write("This file type is not reproduced in the PDF. See the original in the ZIP.", { size: 9 });
  }
  if (!data.files.length) w.write("No files uploaded.");

  // 3. Transcripts
  w.freshPage();
  mark("Transcripts", 0);
  w.write("3. Transcripts", { size: 16, bold: true, gapAfter: 4 });
  w.write(
    "Transcripts as stored by the account holder. Passages marked [Highlighted] and any notes were added by the account holder.",
    { size: 9, gapAfter: 8 },
  );
  if (!data.transcripts.length) w.write("No transcripts.");
  for (const t of data.transcripts) {
    mark(`${t.fileLabel} transcript`, 1);
    w.write(`${t.fileLabel} · ${t.fileName}`, { size: 12, bold: true, gapAfter: 4 });
    t.segments.forEach((s, i) => {
      const h = t.highlights.find((x) => i >= x.startSegment && i <= x.endSegment);
      const time = s.start != null ? `[${formatTimecode(s.start)}] ` : `[${i + 1}] `;
      w.write(`${time}${h ? "[Highlighted] " : ""}${s.speaker ? `${s.speaker}: ` : ""}${s.text}`, { size: 10, bold: Boolean(h) });
      if (h && h.startSegment === i && h.note) w.write(`Account holder's note: ${h.note}`, { size: 9, indent: 16 });
    });
    w.rule();
  }

  // 4. Data requests log
  w.freshPage();
  mark("Data requests log", 0);
  w.write("4. Data requests log", { size: 16, bold: true, gapAfter: 8 });
  if (!data.sars.length) w.write("No data requests recorded.");
  for (const s of data.sars) {
    w.write(s.recipient, { bold: true });
    w.write(`Status: ${SAR_STATUS[s.status] ?? s.status}`, { size: 10 });
    if (s.sentOn) w.write(`Sent: ${formatLongDate(s.sentOn)}`, { size: 10 });
    if (s.receivedOn) w.write(`Received by the organisation: ${formatLongDate(s.receivedOn)}`, { size: 10 });
    if (s.dueOn) w.write(`Response date (one calendar month, as calculated from the dates entered): ${formatLongDate(s.dueOn)}`, { size: 10 });
    for (const r of s.responses) {
      w.write(`Response received ${formatLongDate(r.receivedOn)}${r.description ? `: ${r.description}` : ""}`, { size: 10 });
    }
    w.rule();
  }

  return { marks, checks };
}

async function writeCover(w: TextWriter, data: BundleData) {
  w.space(80);
  w.write("Case bundle", { size: 12 });
  w.write(data.caseTitle, { size: 22, bold: true, gapAfter: 16 });
  for (const [label, value] of data.details) if (value) w.write(`${label}: ${value}`, { size: 11 });
  w.space(16);
  w.write(`Generated ${formatTimestamp(data.generatedAt)}`, { size: 10 });
  if (data.preparedBy) w.write(`Account: ${data.preparedBy}`, { size: 10 });
  w.space(24);
  w.write(
    "This bundle was produced by Evidence Locker from records the account holder entered and files they uploaded. Evidence Locker does not check whether any content is accurate. SHA-256 fingerprints show whether each file is unchanged since it was uploaded.",
    { size: 9 },
  );
}

function writeIndex(w: TextWriter, entries: IndexEntry[]) {
  w.write("Index", { size: 16, bold: true, gapAfter: 8 });
  for (const e of entries) {
    w.row(e.title, String(e.page), { size: e.level === 0 ? 11 : 10, bold: e.level === 0, indent: e.level === 0 ? 0 : 14 });
  }
}

export async function buildBundlePdf(
  data: BundleData,
  bytesFor: (f: BundleFile) => Promise<Uint8Array | null>,
): Promise<{ pdf: Uint8Array; index: IndexEntry[]; checks: FileCheck[] }> {
  const title = `Case bundle: ${data.caseTitle}`;

  const content = await createTextWriter(title);
  const { marks, checks } = await writeContent(content, data, bytesFor);

  const cover = await createTextWriter(title);
  await writeCover(cover, data);
  const coverPages = cover.doc.getPageCount();

  // The index's own length shifts every page number, so lay it out until stable.
  let indexPages = 1;
  let index: IndexEntry[] = [];
  let indexDoc: TextWriter;
  for (;;) {
    const offset = coverPages + indexPages;
    index = marks.map((m) => ({ ...m, page: m.page + offset }));
    indexDoc = await createTextWriter(title);
    writeIndex(indexDoc, index);
    if (indexDoc.doc.getPageCount() === indexPages) break;
    indexPages = indexDoc.doc.getPageCount();
  }

  const out = await PDFDocument.create();
  out.setTitle(title);
  out.setCreator("Evidence Locker");
  out.setProducer("Evidence Locker");
  for (const part of [cover.doc, indexDoc.doc, content.doc]) {
    for (const p of await out.copyPages(part, part.getPageIndices())) out.addPage(p);
  }
  addPageNumbers(out, await out.embedFont("Helvetica"), "Case bundle");
  return { pdf: await out.save(), index, checks };
}
