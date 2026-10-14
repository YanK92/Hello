import type { SarValues } from "@/components/sar/sar-wizard";
import type { SarDetail, SarSummary } from "@/lib/cases/sar";
import { letterInput, sarFormSchema } from "@/lib/sar/form";
import { buildSarLetter } from "@/lib/sar/letter";
import type { RecordingDetail, RecordingSummary } from "@/lib/cases/recordings";
import type { Segment } from "@/lib/transcripts/parse";
import type { Revision } from "@/app/cases/entry-actions";
import type { EvidenceItem } from "@/components/evidence/evidence-list";
import type { CaseData, TimelineEntry } from "@/lib/cases/load";

// Sample data for the dev-only preview screens. Not used anywhere else.

// Fixed clock so server and browser render identical text.
const NOW = Date.parse("2026-10-14T15:30:00Z");
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

function photo(label: string, bg: string, fg: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="${bg}"/><circle cx="60" cy="58" r="30" fill="none" stroke="${fg}" stroke-width="6"/><path d="M60 40v22" stroke="${fg}" stroke-width="7" stroke-linecap="round"/><circle cx="60" cy="74" r="4" fill="${fg}"/><text x="60" y="112" font-size="11" text-anchor="middle" fill="#fff" font-family="sans-serif">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const SAMPLE_USER = "00000000-0000-4000-8000-00000000000a";
export const SAMPLE_CASE = "11111111-1111-4111-8111-111111111111";

export const sampleEvidence: EvidenceItem[] = [
  {
    id: "v1",
    name: "dashboard-warning-light.jpg",
    mime: "image/jpeg",
    size: 2_480_000,
    sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    uploadedAt: minutesAgo(39),
    hashVerifiedAt: minutesAgo(39),
    lastCheckedAt: minutesAgo(2),
    lastCheckOk: true,
    thumbUrl: photo("dashboard", "#2b2f36", "#f2a900"),
  },
  {
    id: "v2",
    name: "odometer.jpg",
    mime: "image/jpeg",
    size: 1_960_000,
    sha256: "60303ae22b998861bce3b28f33eec1be758a213c86c93c076dbe9f558c11c752",
    uploadedAt: minutesAgo(39),
    hashVerifiedAt: minutesAgo(39),
    lastCheckedAt: minutesAgo(1),
    lastCheckOk: false,
    thumbUrl: photo("odometer", "#1f3a52", "#7db3e8"),
  },
  {
    id: "v3",
    name: "sales-invoice.pdf",
    mime: "application/pdf",
    size: 184_000,
    sha256: "fd61a03af4f77d870fc21e05e7e80678095c92d808cfb3b5c279ee04c74aca13",
    uploadedAt: minutesAgo(38),
    hashVerifiedAt: minutesAgo(38),
    lastCheckedAt: null,
    lastCheckOk: true,
    thumbUrl: null,
  },
];

const daysAgo = (d: number, hour = 10) => {
  const t = new Date(NOW - d * 86_400_000);
  t.setUTCHours(hour, 0, 0, 0);
  return t.toISOString();
};

function entry(over: Partial<TimelineEntry> & Pick<TimelineEntry, "id" | "type" | "occurredAt">): TimelineEntry {
  return {
    title: null,
    recordedAt: over.occurredAt,
    editedAt: null,
    who: null,
    notes: null,
    lat: null,
    lng: null,
    accuracy: null,
    locationLabel: null,
    evidence: [],
    linkedEvidenceIds: [],
    ...over,
  };
}

const [dash, odo, invoice] = sampleEvidence;

export const sampleEntries: TimelineEntry[] = [
  entry({
    id: "e0",
    type: "payment",
    title: "Paid deposit and signed finance agreement",
    occurredAt: daysAgo(24, 14),
    who: "Dealer sales team",
    evidence: [invoice],
    linkedEvidenceIds: [invoice.id],
  }),
  entry({
    id: "e1",
    type: "incident",
    title: "Warning light and loss of power on the A40",
    occurredAt: minutesAgo(55),
    recordedAt: minutesAgo(40),
    notes: "Engine warning light came on and the car lost power. Pulled over safely.",
    lat: 51.785123,
    lng: -1.484567,
    accuracy: 8,
    evidence: [dash, odo],
  }),
  entry({
    id: "e2",
    type: "check_in",
    title: "Recovery truck arrived",
    occurredAt: minutesAgo(12),
    notes: "Driver took the car to the dealer's workshop.",
    locationLabel: "Layby on the A40 near Witney",
  }),
  entry({
    id: "e3",
    type: "communication",
    title: "Phoned the dealer about the fault",
    occurredAt: minutesAgo(5),
    recordedAt: minutesAgo(5),
    editedAt: minutesAgo(1),
    who: "Sam, service desk",
    notes: "Asked for an inspection appointment. Given reference SR-1182.",
  }),
];

export const sampleRevisions: Revision[] = [
  {
    revision: 1,
    op: "update",
    changedAt: minutesAgo(1),
    title: "Phoned the dealer",
    type: "communication",
    occurredAt: minutesAgo(5),
    who: "Service desk",
    notes: "Asked for an inspection appointment.",
  },
];

export const sampleCase: CaseData = {
  id: SAMPLE_CASE,
  title: "2019 Ford Focus, AB19 CDE",
  createdAt: daysAgo(24, 14),
  details: [
    ["Item", "2019 Ford Focus, AB19 CDE"],
    ["Seller or trader", "Example Motors Ltd"],
    ["Finance provider", null],
    ["Reference", null],
  ],
  entries: sampleEntries,
  evidence: sampleEvidence,
};

// ---------------------------------------------------------------------------
// Recordings (Phase 3)
// ---------------------------------------------------------------------------

/** One second of silent 8 kHz WAV, so the preview shows a real audio player. */
function silentWav(): string {
  const samples = 8000;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => (bytes[at + i] = c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, "data");
  view.setUint32(40, samples, true);
  bytes.fill(128, 44);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(binary)}`;
}

const recordingBase = {
  mime: "audio/x-m4a",
  hashVerifiedAt: minutesAgo(30),
  lastCheckedAt: minutesAgo(30),
  lastCheckOk: true,
  thumbUrl: null,
};

export const sampleRecordings: RecordingSummary[] = [
  {
    ...recordingBase,
    id: "r1",
    name: "Call with dealer service desk.m4a",
    size: 6_400_000,
    sha256: "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
    uploadedAt: minutesAgo(30),
    transcriptStatus: "done",
    segmentCount: 6,
    highlightCount: 1,
  },
  {
    ...recordingBase,
    id: "r2",
    name: "Voicemail from finance company.m4a",
    size: 820_000,
    sha256: "fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9",
    uploadedAt: minutesAgo(8),
    hashVerifiedAt: minutesAgo(8),
    lastCheckedAt: minutesAgo(8),
    transcriptStatus: "none",
    segmentCount: 0,
    highlightCount: 0,
  },
];

const segments: Segment[] = [
  { start: 0, end: 6.5, speaker: "Me", text: "Hi, I'm calling about the Ford Focus I bought three weeks ago. The engine warning light came on yesterday." },
  { start: 6.5, end: 14.2, speaker: "Service desk", text: "Sorry to hear that. Can you give me the registration?" },
  { start: 14.2, end: 18, speaker: "Me", text: "It's AB19 CDE." },
  { start: 18, end: 31.4, speaker: "Service desk", text: "Thanks. We can book it in for an inspection next Tuesday at nine. The recovery truck brought it here this morning." },
  { start: 31.4, end: 36, speaker: "Me", text: "Can you confirm the inspection by email, please?" },
  { start: 36, end: 41.8, speaker: "Service desk", text: "Yes, I'll email the booking reference this afternoon." },
];

export function sampleRecordingDetail(withTranscript: boolean): RecordingDetail {
  const [r] = sampleRecordings;
  return {
    ...r,
    audioUrl: silentWav(),
    transcript: withTranscript
      ? {
          id: "t1",
          status: "done",
          source: "import",
          model: null,
          error: null,
          updatedAt: minutesAgo(25),
          segments,
        }
      : null,
    highlights: withTranscript
      ? [
          {
            id: "h1",
            startSegment: 3,
            endSegment: 3,
            quote: `Service desk: ${segments[3].text}`,
            note: "Inspection date offered",
            createdAt: minutesAgo(20),
          },
        ]
      : [],
  };
}

// ---------------------------------------------------------------------------
// Data requests (Phase 4)
// ---------------------------------------------------------------------------
export const SAMPLE_NOW = new Date(NOW);

export const sampleSarValues: SarValues = {
  recipient: {
    contactId: null,
    name: "Example Finance Ltd, Data Protection Officer",
    address: "1 High Street\nLeeds\nLS1 1AA",
    email: "dpo@example-finance.test",
    save: true,
  },
  categories: ["all", "calls", "account", "article15"],
  dateFrom: "2026-09-01",
  dateTo: "",
  format: "electronic",
  requester: {
    fullName: "Alex Taylor",
    address: "2 Low Road\nYork\nYO1 1BB",
    email: "alex@example.test",
    phone: "",
    references: [
      { label: "Agreement or account number", value: "AG-12345" },
      { label: "Vehicle registration", value: "AB19 CDE" },
    ],
    other: "",
  },
};

const sampleLetter = buildSarLetter(letterInput(sarFormSchema.parse(sampleSarValues), "2026-09-28")).body;

export const sampleSars: SarSummary[] = [
  {
    id: "s1",
    recipient: "Example Finance Ltd, Data Protection Officer",
    status: "sent",
    sentOn: "2026-09-28",
    receivedOn: "2026-09-29",
    dueOn: "2026-10-29",
    extendedDueOn: "2026-12-29",
    createdAt: minutesAgo(60 * 24 * 16),
    responseCount: 0,
  },
  {
    id: "s2",
    recipient: "Example Motors Ltd",
    status: "response_received",
    sentOn: "2026-08-03",
    receivedOn: null,
    dueOn: "2026-09-03",
    extendedDueOn: "2026-11-03",
    createdAt: minutesAgo(60 * 24 * 72),
    responseCount: 1,
  },
  {
    id: "s3",
    recipient: "Example Recovery Services",
    status: "draft",
    sentOn: null,
    receivedOn: null,
    dueOn: null,
    extendedDueOn: null,
    createdAt: minutesAgo(30),
    responseCount: 0,
  },
];

export function sampleSarDetail(kind: "draft" | "sent" | "responded"): SarDetail {
  const base = kind === "draft" ? sampleSars[2] : kind === "sent" ? sampleSars[0] : sampleSars[1];
  return {
    ...base,
    recipient: kind === "draft" ? base.recipient : sampleSarValues.recipient.name,
    recipientEmail: sampleSarValues.recipient.email,
    recipientAddress: sampleSarValues.recipient.address,
    sentMethod: kind === "draft" ? null : "email",
    categories: sampleSarValues.categories,
    dateFrom: sampleSarValues.dateFrom,
    dateTo: null,
    format: "electronic",
    requester: sampleSarValues.requester,
    letterText: sampleLetter,
    responses:
      kind === "responded"
        ? [
            {
              id: "resp1",
              receivedOn: "2026-09-01",
              description: "Covering letter and 42 pages of account notes, by email.",
              eventId: "e9",
              files: [{ ...sampleEvidence[2], id: "v9", name: "sar-response-account-notes.pdf", size: 1_240_000 }],
            },
          ]
        : [],
  };
}
