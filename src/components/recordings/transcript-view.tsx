"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { addHighlight, deleteHighlight, updateHighlightNote } from "@/app/cases/recording-actions";
import type { Highlight } from "@/lib/cases/recordings";
import { formatTimecode, type Segment } from "@/lib/transcripts/parse";

function Found({ text, needle }: { text: string; needle: string }) {
  if (!needle) return <>{text}</>;
  const lower = text.toLowerCase();
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    const at = lower.indexOf(needle, i);
    if (at === -1) {
      out.push(text.slice(i));
      break;
    }
    if (at > i) out.push(text.slice(i, at));
    out.push(<mark key={at}>{text.slice(at, at + needle.length)}</mark>);
    i = at + needle.length;
  }
  return <>{out}</>;
}

export function TranscriptView({
  transcriptId,
  segments,
  highlights,
  audioUrl,
  initialFind = "",
  initialRange,
}: {
  transcriptId: string;
  segments: Segment[];
  highlights: Highlight[];
  audioUrl: string | null;
  /** Dev preview only. */
  initialFind?: string;
  initialRange?: [number, number];
}) {
  const router = useRouter();
  const audio = useRef<HTMLAudioElement>(null);
  const [find, setFind] = useState(initialFind);
  const [range, setRange] = useState<[number, number] | null>(initialRange ?? null);
  const [note, setNote] = useState("");
  const [current, setCurrent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const needle = find.trim().toLowerCase();
  const timed = segments.some((s) => s.start != null);

  const highlightAt = useMemo(() => {
    const map = new Map<number, Highlight>();
    for (const h of highlights) for (let i = h.startSegment; i <= h.endSegment; i++) map.set(i, h);
    return map;
  }, [highlights]);

  const matches = needle
    ? segments.filter((s) => `${s.speaker ?? ""} ${s.text}`.toLowerCase().includes(needle)).length
    : 0;

  function seek(seconds: number) {
    if (!audio.current) return;
    audio.current.currentTime = seconds;
    void audio.current.play();
  }

  function onTime() {
    const t = audio.current?.currentTime ?? 0;
    const i = segments.findIndex((s) => s.start != null && s.end != null && t >= s.start && t < s.end);
    setCurrent(i === -1 ? null : i);
  }

  function save() {
    if (!range) return;
    setError(null);
    startTransition(async () => {
      const result = await addHighlight({ transcriptId, startSegment: range[0], endSegment: range[1], note });
      if (result.ok) {
        setRange(null);
        setNote("");
        router.refresh();
      } else setError(result.error);
    });
  }

  return (
    <div className="stack">
      {audioUrl && (
        <audio ref={audio} className="audio-player" controls preload="metadata" src={audioUrl} onTimeUpdate={onTime}>
          Your browser cannot play this recording.
        </audio>
      )}

      <div className="field">
        <label htmlFor="find-in-transcript">Find in this transcript</label>
        <input id="find-in-transcript" type="search" value={find} onChange={(e) => setFind(e.target.value)} />
        {needle && (
          <span className="hint" aria-live="polite">
            {matches} {matches === 1 ? "passage matches" : "passages match"}
          </span>
        )}
      </div>

      {highlights.length > 0 && <HighlightList highlights={highlights} />}

      <ol className="transcript">
        {segments.map((s, i) => {
          const h = highlightAt.get(i);
          const inRange = range && i >= range[0] && i <= range[1];
          const hidden = needle && !`${s.speaker ?? ""} ${s.text}`.toLowerCase().includes(needle);
          return (
            <li
              key={i}
              id={`passage-${i}`}
              className="passage"
              data-highlighted={h ? true : undefined}
              data-selecting={inRange || undefined}
              data-current={current === i || undefined}
              data-dimmed={hidden || undefined}
            >
              <div className="passage-head">
                {s.start != null ? (
                  <button type="button" className="timecode" onClick={() => seek(s.start!)} aria-label={`Play from ${formatTimecode(s.start)}`}>
                    {formatTimecode(s.start)}
                  </button>
                ) : (
                  <span className="timecode muted">{i + 1}</span>
                )}
                {s.speaker && <strong className="speaker">{s.speaker}</strong>}
              </div>
              <p className="passage-text">
                <Found text={s.text} needle={needle} />
              </p>
              {h && h.startSegment === i && h.note && <p className="passage-note small">Your note: {h.note}</p>}
              {!range && !h && (
                <button type="button" className="link-button small" onClick={() => setRange([i, i])}>
                  Highlight
                </button>
              )}
              {range && i > range[1] && (
                <button type="button" className="link-button small" onClick={() => setRange([range[0], i])}>
                  Extend highlight to here
                </button>
              )}
              {range && i === range[1] && (
                <div className="highlight-form stack-sm">
                  <div className="field">
                    <label htmlFor="highlight-note">
                      Note <span className="muted">(optional)</span>
                    </label>
                    <textarea id="highlight-note" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>
                  {error && <p className="error small">{error}</p>}
                  <div className="button-row">
                    <button type="button" className="button" data-variant="secondary" onClick={() => setRange(null)}>
                      Cancel
                    </button>
                    <button type="button" className="button" onClick={save} disabled={pending}>
                      {pending ? "Saving…" : `Save highlight${range[1] > range[0] ? ` (${range[1] - range[0] + 1} passages)` : ""}`}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {!timed && <p className="muted small">This transcript has no timings, so passages are numbered instead.</p>}
    </div>
  );
}

function HighlightList({ highlights }: { highlights: Highlight[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <section className="card stack-sm" aria-labelledby="highlights-heading">
      <h2 id="highlights-heading" className="card-title">
        Your highlights ({highlights.length})
      </h2>
      <ul className="highlight-list">
        {highlights.map((h) => (
          <li key={h.id}>
            <a href={`#passage-${h.startSegment}`} className="small">
              Passage {h.startSegment + 1}
              {h.endSegment > h.startSegment && `–${h.endSegment + 1}`}
            </a>
            <blockquote className="quote">{h.quote}</blockquote>
            {editing === h.id ? (
              <div className="stack-sm">
                <label htmlFor={`note-${h.id}`} className="visually-hidden">
                  Note
                </label>
                <textarea id={`note-${h.id}`} rows={2} maxLength={2000} value={draft} onChange={(e) => setDraft(e.target.value)} />
                <div className="button-row">
                  <button type="button" className="button" data-variant="secondary" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await updateHighlightNote(h.id, draft);
                        setEditing(null);
                        router.refresh();
                      })
                    }
                  >
                    Save note
                  </button>
                </div>
              </div>
            ) : (
              h.note && <p className="small">Your note: {h.note}</p>
            )}
            <div className="entry-actions">
              <button
                type="button"
                className="link-button small"
                onClick={() => {
                  setDraft(h.note ?? "");
                  setEditing(h.id);
                }}
              >
                {h.note ? "Edit note" : "Add note"}
              </button>
              <button
                type="button"
                className="link-button small danger"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteHighlight(h.id);
                    router.refresh();
                  })
                }
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
