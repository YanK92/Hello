"use client";

import { useState, useTransition } from "react";
import { createEntry, updateEntry } from "@/app/cases/entry-actions";
import type { EvidenceItem } from "@/components/evidence/evidence-list";
import { ENTRY_TYPES, type EntryType } from "@/lib/chronology";
import { toDateTimeLocal } from "@/lib/format";

export interface EntryFormValues {
  type: EntryType;
  title: string;
  occurredAtLocal: string;
  who: string;
  notes: string;
  evidenceIds: string[];
}

/** Add or edit a chronology entry. Pass `eventId` to edit. */
export function EntryForm({
  caseId,
  eventId,
  initial,
  evidence,
  lockedEvidenceIds = [],
  onDone,
  onCancel,
}: {
  caseId: string;
  eventId?: string;
  initial?: Partial<EntryFormValues>;
  evidence: EvidenceItem[];
  /** Files captured with this entry: always attached, shown ticked and disabled. */
  lockedEvidenceIds?: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<EntryFormValues>(() => ({
    type: "note",
    title: "",
    occurredAtLocal: toDateTimeLocal(new Date()),
    who: "",
    notes: "",
    evidenceIds: [],
    ...initial,
  }));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<EntryFormValues>) => setValues((v) => ({ ...v, ...patch }));
  const prefix = eventId ?? "new";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!values.occurredAtLocal) return setError("Add the date and time.");
    const input = {
      type: values.type,
      title: values.title,
      occurredAt: new Date(values.occurredAtLocal).toISOString(),
      who: values.who,
      notes: values.notes,
      evidenceIds: values.evidenceIds,
    };
    startTransition(async () => {
      const result = eventId ? await updateEntry(eventId, input) : await createEntry(caseId, input);
      if (result.ok) onDone();
      else setError(result.error);
    });
  }

  function toggle(id: string) {
    set({
      evidenceIds: values.evidenceIds.includes(id)
        ? values.evidenceIds.filter((x) => x !== id)
        : [...values.evidenceIds, id],
    });
  }

  return (
    <form onSubmit={submit} className="stack-sm entry-form">
      <div className="field">
        <label htmlFor={`${prefix}-type`}>Type</label>
        <select
          id={`${prefix}-type`}
          value={values.type}
          onChange={(e) => set({ type: e.target.value as EntryType })}
        >
          {Object.entries(ENTRY_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-title`}>What happened</label>
        <input
          id={`${prefix}-title`}
          type="text"
          maxLength={200}
          required
          placeholder="For example: Phoned the dealer about the warning light"
          value={values.title}
          onChange={(e) => set({ title: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-when`}>When</label>
        <input
          id={`${prefix}-when`}
          type="datetime-local"
          required
          value={values.occurredAtLocal}
          onChange={(e) => set({ occurredAtLocal: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-who`}>
          Who was involved <span className="muted">(optional)</span>
        </label>
        <input
          id={`${prefix}-who`}
          type="text"
          maxLength={200}
          placeholder="Names, roles or organisations"
          value={values.who}
          onChange={(e) => set({ who: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-notes`}>
          Notes <span className="muted">(optional)</span>
        </label>
        <textarea
          id={`${prefix}-notes`}
          rows={3}
          maxLength={10000}
          value={values.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />
      </div>
      {evidence.length > 0 && (
        <fieldset className="evidence-picker">
          <legend>Source files</legend>
          {evidence.map((item) => {
            const locked = lockedEvidenceIds.includes(item.id);
            return (
              <label key={item.id} className="check-row">
                <input
                  type="checkbox"
                  checked={locked || values.evidenceIds.includes(item.id)}
                  disabled={locked}
                  onChange={() => toggle(item.id)}
                />
                <span>
                  {item.name}
                  {locked && <span className="muted small"> (taken with this entry)</span>}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row">
        <button type="button" className="button" data-variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button className="button" disabled={pending}>
          {pending ? "Saving…" : eventId ? "Save changes" : "Add entry"}
        </button>
      </div>
    </form>
  );
}
