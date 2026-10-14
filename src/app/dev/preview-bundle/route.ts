import { deflateSync } from "node:zlib";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { NextResponse } from "next/server";
import { buildBundlePdf, type BundleData, type BundleFile } from "@/lib/export/bundle";
import { sha256Hex } from "@/lib/integrity";
import { previewEnabled } from "../preview/screens";

// Dev only: a real bundle PDF built from sample data, to see the layout.

function crc32(bytes: Uint8Array) {
  let c = ~0;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

/** A simple striped PNG standing in for a photo. */
function samplePng(w: number, h: number, [r, g, b]: [number, number, number]) {
  const raw = new Uint8Array((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const shade = ((x >> 4) + (y >> 4)) % 2 ? 1 : 0.8;
      raw.set([r * shade, g * shade, b * shade], y * (w * 3 + 1) + 1 + x * 3);
    }
  }
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    out.set(new TextEncoder().encode(type), 4);
    out.set(data, 8);
    view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const ihdr = new Uint8Array(13);
  new DataView(ihdr.buffer).setUint32(0, w);
  new DataView(ihdr.buffer).setUint32(4, h);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const parts = [
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", new Uint8Array(deflateSync(raw))),
    chunk("IEND", new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

async function sampleInvoice() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  page.drawText("Example Motors Ltd — Sales invoice 0042", { x: 56, y: 760, size: 16, font });
  page.drawText("2019 Ford Focus, AB19 CDE ........ £11,995.00", { x: 56, y: 720, size: 12, font });
  return doc.save();
}

export async function GET() {
  if (!previewEnabled()) return NextResponse.json({ error: "not found" }, { status: 404 });
  const dash = samplePng(480, 320, [40, 44, 52]);
  const odo = samplePng(480, 320, [31, 58, 82]);
  const invoice = await sampleInvoice();
  const changedOdo = odo.slice();
  changedOdo[changedOdo.length - 20] ^= 1;

  const bytes: Record<string, Uint8Array> = { a: dash, b: changedOdo, c: invoice };
  const files: BundleFile[] = [
    { id: "c", label: "F1", name: "sales-invoice.pdf", mime: "application/pdf", size: invoice.length, sha256: await sha256Hex(invoice), uploadedAt: "2026-09-20T14:05:00Z", hashVerifiedAt: "2026-09-20T14:05:00Z", entryTitles: ["Paid deposit and signed finance agreement"] },
    { id: "a", label: "F2", name: "dashboard-warning-light.png", mime: "image/png", size: dash.length, sha256: await sha256Hex(dash), uploadedAt: "2026-10-14T14:51:00Z", hashVerifiedAt: "2026-10-14T14:51:00Z", entryTitles: ["Warning light and loss of power on the A40"] },
    { id: "b", label: "F3", name: "odometer.png", mime: "image/png", size: odo.length, sha256: await sha256Hex(odo), uploadedAt: "2026-10-14T14:51:00Z", hashVerifiedAt: "2026-10-14T14:51:00Z", entryTitles: ["Warning light and loss of power on the A40"] },
  ];
  const data: BundleData = {
    caseTitle: "2019 Ford Focus, AB19 CDE",
    details: [["Item", "2019 Ford Focus, AB19 CDE"], ["Seller or trader", "Example Motors Ltd"]],
    generatedAt: "2026-10-14T16:30:00Z",
    preparedBy: "alex@example.test",
    entries: [
      { occurredAt: "2026-09-20T14:00:00Z", recordedAt: "2026-09-20T14:06:00Z", editedAt: null, type: "payment", title: "Paid deposit and signed finance agreement", who: "Dealer sales team", notes: null, location: null, fileLabels: ["F1"] },
      { occurredAt: "2026-10-14T14:35:00Z", recordedAt: "2026-10-14T14:50:00Z", editedAt: null, type: "incident", title: "Warning light and loss of power on the A40", who: null, notes: "Engine warning light came on and the car lost power. Pulled over safely.", location: "51.785123, -1.484567 (±8 m)", fileLabels: ["F2", "F3"] },
      { occurredAt: "2026-10-14T15:25:00Z", recordedAt: "2026-10-14T15:25:00Z", editedAt: "2026-10-14T15:29:00Z", type: "communication", title: "Phoned the dealer about the fault", who: "Sam, service desk", notes: "Asked for an inspection appointment. Given reference SR-1182.", location: null, fileLabels: [] },
    ],
    files,
    transcripts: [
      {
        fileLabel: "F4",
        fileName: "Call with dealer service desk.m4a",
        segments: [
          { start: 0, end: 6.5, speaker: "Me", text: "Hi, I'm calling about the Ford Focus I bought three weeks ago." },
          { start: 6.5, end: 14.2, speaker: "Service desk", text: "Can you give me the registration?" },
          { start: 18, end: 31.4, speaker: "Service desk", text: "We can book it in for an inspection next Tuesday at nine." },
        ],
        highlights: [{ startSegment: 2, endSegment: 2, note: "Inspection date offered" }],
      },
    ],
    sars: [
      { recipient: "Example Finance Ltd, Data Protection Officer", status: "sent", sentOn: "2026-09-28", receivedOn: "2026-09-29", dueOn: "2026-10-29", responses: [] },
    ],
  };
  const { pdf } = await buildBundlePdf(data, async (f) => bytes[f.id] ?? null);
  return new NextResponse(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf" } });
}
