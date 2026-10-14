"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addDocumentNote, deleteDocumentNote } from "@/app/cases/note-actions";
import { IntegrityBadge } from "@/components/evidence/integrity-badge";
import type { EvidenceItem } from "@/components/evidence/evidence-list";

export interface DocumentNote {
  id: string;
  page: number | null;
  note: string;
}

export interface PaneDocument extends EvidenceItem {
  /** Signed URL for viewing the original. */
  url: string | null;
  notes: DocumentNote[];
}

export function DocumentPane({ doc, side }: { doc: PaneDocument; side: "left" | "right" }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [page, setPage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const id = `${side}-${doc.id}`;

  return (
    <section className="card stack-sm pane" aria-label={doc.name}>
      <strong className="break">{doc.name}</strong>
      <IntegrityBadge {...doc} />
      <div className="pane-view">
        {!doc.url ? (
          <p className="muted small">Preview not available.</p>
        ) : doc.mime.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={doc.url} alt={doc.name} />
        ) : doc.mime === "application/pdf" ? (
          <iframe src={doc.url} title={doc.name} />
        ) : doc.mime.startsWith("audio/") ? (
          <audio controls src={doc.url} className="audio-player" />
        ) : (
          <p className="muted small">Preview not available.</p>
        )}
      </div>
      {doc.url && (
        <a href={doc.url} target="_blank" rel="noreferrer" className="small">
          Open the original in a new tab
        </a>
      )}

      <h3 className="small">Your notes ({doc.notes.length})</h3>
      {doc.notes.length > 0 && (
        <ul className="note-list">
          {doc.notes.map((n) => (
            <li key={n.id}>
              <span className="small">
                {n.page != null && <strong>Page {n.page}: </strong>}
                {n.note}
              </span>
              <button
                type="button"
                className="link-button small danger"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteDocumentNote(n.id);
                    router.refresh();
                  })
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="stack-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await addDocumentNote({ evidenceId: doc.id, page: page ? Number(page) : null, note });
            if (result.ok) {
              setNote("");
              setPage("");
              router.refresh();
            } else setError(result.error);
          });
        }}
      >
        <div className="note-row">
          <div className="field page-field">
            <label htmlFor={`${id}-page`}>Page</label>
            <input id={`${id}-page`} type="number" min={1} inputMode="numeric" value={page} onChange={(e) => setPage(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-note`}>Note</label>
            <input id={`${id}-note`} type="text" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        {error && <p className="error small">{error}</p>}
        <button className="button" data-variant="secondary" data-size="small" disabled={pending || !note.trim()}>
          Add note
        </button>
      </form>
    </section>
  );
}
