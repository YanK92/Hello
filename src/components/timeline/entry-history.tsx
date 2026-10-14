"use client";

import { useEffect, useState } from "react";
import { entryHistory, type Revision } from "@/app/cases/entry-actions";
import { entryTypeLabel } from "@/lib/chronology";
import { formatDateTime, formatTimestamp } from "@/lib/format";

/** Earlier versions of an entry. Pass `revisions` to render without fetching. */
export function EntryHistory({ eventId, revisions: given }: { eventId: string; revisions?: Revision[] }) {
  const [revisions, setRevisions] = useState<Revision[] | null>(given ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (given) return;
    let live = true;
    entryHistory(eventId).then((r) => {
      if (!live) return;
      if (r.ok) setRevisions(r.revisions);
      else setError(r.error);
    });
    return () => {
      live = false;
    };
  }, [eventId, given]);

  if (error) return <p className="error small">{error}</p>;
  if (!revisions) return <p className="muted small">Loading history…</p>;
  if (!revisions.length) return <p className="muted small">This entry has not been edited.</p>;

  return (
    <ol className="history">
      {revisions.map((r) => (
        <li key={r.revision}>
          <span className="small muted">
            Version before the change on {formatTimestamp(r.changedAt)}
          </span>
          <span className="small">
            <strong>{r.title ?? entryTypeLabel(r.type)}</strong> · {entryTypeLabel(r.type)} ·{" "}
            {formatDateTime(r.occurredAt)}
            {r.who && ` · ${r.who}`}
          </span>
          {r.notes && <span className="small history-notes">{r.notes}</span>}
        </li>
      ))}
    </ol>
  );
}
