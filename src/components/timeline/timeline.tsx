"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Revision } from "@/app/cases/entry-actions";
import type { EvidenceItem } from "@/components/evidence/evidence-list";
import { EMPTY_FILTER, ENTRY_TYPES, matchesFilter, type TimelineFilter } from "@/lib/chronology";
import type { TimelineEntry } from "@/lib/cases/load";
import { calendarDaysBetween } from "@/lib/dates";
import { formatDateTime } from "@/lib/format";
import { EntryForm, type EntryFormValues } from "./entry-form";
import { TimelineEntryCard } from "./timeline-entry-card";

export interface TimelinePreview {
  filter?: TimelineFilter;
  selected?: string[];
  adding?: Partial<EntryFormValues>;
  openPanel?: { id: string; panel: "edit" | "history"; revisions?: Revision[] };
}

export function Timeline({
  caseId,
  entries,
  evidence,
  preview,
}: {
  caseId: string;
  entries: TimelineEntry[];
  evidence: EvidenceItem[];
  /** Dev preview only: start in a given state. */
  preview?: TimelinePreview;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<TimelineFilter>(preview?.filter ?? EMPTY_FILTER);
  const [newestFirst, setNewestFirst] = useState(false);
  const [selected, setSelected] = useState<string[]>(preview?.selected ?? []);
  const [adding, setAdding] = useState(Boolean(preview?.adding));

  const visible = useMemo(() => {
    const list = entries.filter((e) =>
      matchesFilter({ ...e, evidence: e.evidence.map((f) => ({ name: f.name })) }, filter),
    );
    return newestFirst ? [...list].reverse() : list;
  }, [entries, filter, newestFirst]);

  const typesInUse = Object.entries(ENTRY_TYPES).filter(([t]) => entries.some((e) => e.type === t));
  const picked = selected.map((id) => entries.find((e) => e.id === id)).filter((e): e is TimelineEntry => Boolean(e));

  function toggleSelect(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s.slice(-1), id]));
  }

  function toggleType(type: string) {
    setFilter((f) => ({
      ...f,
      types: f.types.includes(type) ? f.types.filter((t) => t !== type) : [...f.types, type],
    }));
  }

  return (
    <div className="stack">
      {adding ? (
        <section className="card stack-sm" aria-labelledby="add-entry-heading">
          <h2 id="add-entry-heading" className="card-title">
            Add an entry
          </h2>
          <EntryForm
            caseId={caseId}
            evidence={evidence}
            initial={preview?.adding}
            onCancel={() => setAdding(false)}
            onDone={() => {
              setAdding(false);
              router.refresh();
            }}
          />
        </section>
      ) : (
        <button type="button" className="button" onClick={() => setAdding(true)}>
          Add an entry
        </button>
      )}

      <section className="card stack-sm timeline-filters" aria-label="Filter the timeline">
        <div className="field">
          <label htmlFor="timeline-search">Search entries</label>
          <input
            id="timeline-search"
            type="search"
            placeholder="Words in titles, notes, people or file names"
            value={filter.text}
            onChange={(e) => setFilter({ ...filter, text: e.target.value })}
          />
        </div>
        {typesInUse.length > 1 && (
          <div className="chips" role="group" aria-label="Entry types">
            {typesInUse.map(([type, label]) => (
              <button
                key={type}
                type="button"
                className="chip"
                aria-pressed={filter.types.includes(type)}
                onClick={() => toggleType(type)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="filter-row">
          <label className="check-row">
            <input
              type="checkbox"
              checked={filter.withFilesOnly}
              onChange={(e) => setFilter({ ...filter, withFilesOnly: e.target.checked })}
            />
            <span>Only entries with files</span>
          </label>
          <button type="button" className="link-button small" onClick={() => setNewestFirst(!newestFirst)}>
            {newestFirst ? "Show oldest first" : "Show newest first"}
          </button>
        </div>
      </section>

      <DayCount picked={picked} onClear={() => setSelected([])} />

      <p className="muted small" aria-live="polite">
        Showing {visible.length} of {entries.length} entries. Tick two entries to count the days between them.
      </p>

      {visible.length === 0 ? (
        <p className="muted">{entries.length ? "No entries match these filters." : "No entries yet."}</p>
      ) : (
        <ol className="entry-list timeline">
          {visible.map((entry) => (
            <TimelineEntryCard
              key={entry.id}
              entry={entry}
              caseId={caseId}
              caseEvidence={evidence}
              selectable
              selected={selected.includes(entry.id)}
              onSelect={() => toggleSelect(entry.id)}
              initialPanel={preview?.openPanel?.id === entry.id ? preview.openPanel.panel : "none"}
              previewRevisions={preview?.openPanel?.id === entry.id ? preview.openPanel.revisions : undefined}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function DayCount({ picked, onClear }: { picked: TimelineEntry[]; onClear: () => void }) {
  if (picked.length < 2) return null;
  const [a, b] = [...picked].sort((x, y) => x.occurredAt.localeCompare(y.occurredAt));
  const days = calendarDaysBetween(a.occurredAt, b.occurredAt);
  return (
    <div className="card day-count" role="status">
      <strong>
        {days} {days === 1 ? "day" : "days"} between these entries
      </strong>
      <span className="small muted">
        {formatDateTime(a.occurredAt)} → {formatDateTime(b.occurredAt)} (calendar days, UK time)
      </span>
      <button type="button" className="link-button small" onClick={onClear}>
        Clear selection
      </button>
    </div>
  );
}
