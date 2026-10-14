"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { searchTranscripts, type TranscriptHit } from "@/app/cases/recording-actions";
import { MarkedText } from "./marked-text";

export function TranscriptSearch({
  caseId,
  names,
  initial,
}: {
  caseId: string;
  /** Recording names by evidence id. */
  names: Record<string, string>;
  /** Dev preview only. */
  initial?: { query: string; hits: TranscriptHit[] };
}) {
  const [query, setQuery] = useState(initial?.query ?? "");
  const [hits, setHits] = useState<TranscriptHit[] | null>(initial?.hits ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function search(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await searchTranscripts(caseId, query);
      if (result.ok) setHits(result.hits);
      else setError(result.error);
    });
  }

  return (
    <section className="card stack-sm" aria-labelledby="transcript-search-heading">
      <h2 id="transcript-search-heading" className="card-title">
        Search transcripts
      </h2>
      <form onSubmit={search} className="search-row" role="search">
        <label htmlFor="transcript-q" className="visually-hidden">
          Words to find
        </label>
        <input
          id="transcript-q"
          type="search"
          placeholder={'For example: inspection or "next Tuesday"'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="button" disabled={pending || !query.trim()}>
          {pending ? "Searching…" : "Search"}
        </button>
      </form>
      {error && <p className="error small">{error}</p>}
      {hits && (
        <ul className="search-hits" aria-live="polite">
          {hits.length === 0 && <li className="muted small">No matches.</li>}
          {hits.map((hit) => (
            <li key={hit.evidenceId}>
              <Link href={`/cases/${caseId}/recordings/${hit.evidenceId}`}>
                {names[hit.evidenceId] ?? "Recording"}
              </Link>
              <p className="small">
                <MarkedText text={hit.headline} />
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
