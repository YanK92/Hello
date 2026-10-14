"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteEntry, type Revision } from "@/app/cases/entry-actions";
import type { EvidenceItem } from "@/components/evidence/evidence-list";
import { IntegrityBadge } from "@/components/evidence/integrity-badge";
import { entryTypeLabel, type EntryType } from "@/lib/chronology";
import type { TimelineEntry } from "@/lib/cases/load";
import { formatDateTime, formatTimestamp, toDateTimeLocal } from "@/lib/format";
import { EntryForm } from "./entry-form";
import { EntryHistory } from "./entry-history";

type Panel = "none" | "edit" | "history";

export function TimelineEntryCard({
  entry,
  caseId,
  caseEvidence,
  readOnly = false,
  selectable = false,
  selected = false,
  onSelect,
  initialPanel = "none",
  previewRevisions,
}: {
  entry: TimelineEntry;
  caseId: string;
  caseEvidence: EvidenceItem[];
  readOnly?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  initialPanel?: Panel;
  /** Dev preview only: show this history instead of fetching it. */
  previewRevisions?: Revision[];
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(initialPanel);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const captured = entry.evidence.filter((e) => !entry.linkedEvidenceIds.includes(e.id)).map((e) => e.id);

  function remove() {
    if (!window.confirm("Delete this entry? A copy is kept in the case history.")) return;
    startTransition(async () => {
      const result = await deleteEntry(entry.id);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <li className="card entry" data-selected={selected || undefined}>
      <div className="entry-head">
        {selectable && (
          <input
            type="checkbox"
            className="entry-select"
            aria-label={`Select "${entry.title ?? entryTypeLabel(entry.type)}" to count days`}
            checked={selected}
            onChange={onSelect}
          />
        )}
        <span className="entry-type">{entryTypeLabel(entry.type)}</span>
        <time dateTime={entry.occurredAt}>{formatDateTime(entry.occurredAt)}</time>
      </div>
      {entry.title && <strong className="entry-title">{entry.title}</strong>}
      {entry.who && <span className="small">Who: {entry.who}</span>}
      {entry.notes && <p className="entry-notes">{entry.notes}</p>}
      <EntryLocation entry={entry} />

      {entry.evidence.length > 0 && (
        <ul className="entry-files" aria-label="Files">
          {entry.evidence.map((file) => (
            <li key={file.id}>
              <span className="entry-file-thumb" aria-hidden>
                {file.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.thumbUrl} alt="" loading="lazy" />
                ) : (
                  "PDF"
                )}
              </span>
              <span className="entry-file-body">
                <span className="small entry-file-name">{file.name}</span>
                <IntegrityBadge {...file} />
              </span>
            </li>
          ))}
        </ul>
      )}

      <span className="muted small">
        Recorded {formatTimestamp(entry.recordedAt)}
        {entry.editedAt && ` · Edited ${formatDateTime(entry.editedAt)}`}
      </span>

      {!readOnly && (
        <div className="entry-actions">
          <button type="button" className="link-button small" onClick={() => setPanel(panel === "edit" ? "none" : "edit")}>
            Edit
          </button>
          {entry.editedAt && (
            <button
              type="button"
              className="link-button small"
              onClick={() => setPanel(panel === "history" ? "none" : "history")}
            >
              {panel === "history" ? "Hide history" : "History"}
            </button>
          )}
          <button type="button" className="link-button small danger" onClick={remove} disabled={pending}>
            Delete
          </button>
        </div>
      )}
      {error && <p className="error small">{error}</p>}

      {panel === "history" && <EntryHistory eventId={entry.id} revisions={previewRevisions} />}
      {panel === "edit" && (
        <EntryForm
          caseId={caseId}
          eventId={entry.id}
          evidence={caseEvidence}
          lockedEvidenceIds={captured}
          initial={{
            type: entry.type as EntryType,
            title: entry.title ?? "",
            occurredAtLocal: toDateTimeLocal(new Date(entry.occurredAt)),
            who: entry.who ?? "",
            notes: entry.notes ?? "",
            evidenceIds: entry.linkedEvidenceIds,
          }}
          onCancel={() => setPanel("none")}
          onDone={() => {
            setPanel("none");
            router.refresh();
          }}
        />
      )}
    </li>
  );
}

function EntryLocation({ entry }: { entry: TimelineEntry }) {
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
