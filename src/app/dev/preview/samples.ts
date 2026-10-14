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
