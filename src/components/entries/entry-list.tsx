import { formatDateTime, formatTimestamp } from "@/lib/format";

export interface Entry {
  id: string;
  type: string;
  occurredAt: string;
  recordedAt: string;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  locationLabel: string | null;
  evidenceCount: number;
}

const TYPE_LABELS: Record<string, string> = {
  incident: "What happened",
  check_in: "Check-in",
  note: "Note",
};

function Location({ entry }: { entry: Entry }) {
  if (entry.lat != null && entry.lng != null) {
    const href = `https://www.openstreetmap.org/?mlat=${entry.lat}&mlon=${entry.lng}#map=17/${entry.lat}/${entry.lng}`;
    return (
      <span className="small">
        📍{" "}
        <a href={href} target="_blank" rel="noreferrer">
          {entry.lat}, {entry.lng}
        </a>
        {entry.accuracy != null && <span className="muted"> (±{entry.accuracy} m)</span>}
      </span>
    );
  }
  if (entry.locationLabel) return <span className="small">📍 {entry.locationLabel}</span>;
  return null;
}

export function EntryList({ entries }: { entries: Entry[] }) {
  if (!entries.length) return <p className="muted">No entries yet.</p>;

  return (
    <ol className="entry-list">
      {entries.map((e) => (
        <li key={e.id} className="card entry">
          <div className="entry-head">
            <span className="entry-type">{TYPE_LABELS[e.type] ?? e.type}</span>
            <time dateTime={e.occurredAt}>{formatDateTime(e.occurredAt)}</time>
          </div>
          {e.notes && <p className="entry-notes">{e.notes}</p>}
          <Location entry={e} />
          <span className="muted small">
            Recorded {formatTimestamp(e.recordedAt)}
            {e.evidenceCount > 0 && ` · ${e.evidenceCount} file${e.evidenceCount === 1 ? "" : "s"}`}
          </span>
        </li>
      ))}
    </ol>
  );
}
