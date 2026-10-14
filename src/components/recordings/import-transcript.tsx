"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { importTranscript, transcribeRecording } from "@/app/cases/recording-actions";

export function ImportTranscript({
  evidenceId,
  canTranscribe,
  replacing = false,
}: {
  evidenceId: string;
  canTranscribe: boolean;
  replacing?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"paste" | "file">("paste");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const content = mode === "file" ? (file ? await file.text() : "") : text;
      const result = await importTranscript({
        evidenceId,
        fileName: mode === "file" ? (file?.name ?? "") : "pasted.txt",
        content,
      });
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  function transcribe() {
    setError(null);
    startTransition(async () => {
      const result = await transcribeRecording(evidenceId);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="stack-sm">
      {canTranscribe && (
        <>
          <button type="button" className="button" onClick={transcribe} disabled={pending}>
            {pending ? "Working…" : "Transcribe this recording"}
          </button>
          <p className="muted small">Or add a transcript you already have:</p>
        </>
      )}
      <form onSubmit={save} className="stack-sm">
        <div className="chips" role="group" aria-label="How to add the transcript">
          <button type="button" className="chip" aria-pressed={mode === "paste"} onClick={() => setMode("paste")}>
            Paste text
          </button>
          <button type="button" className="chip" aria-pressed={mode === "file"} onClick={() => setMode("file")}>
            Upload a file
          </button>
        </div>
        {mode === "paste" ? (
          <div className="field">
            <label htmlFor="transcript-text">Transcript</label>
            <span className="hint">Leave a blank line between speakers. &ldquo;Name: words&rdquo; marks who is speaking.</span>
            <textarea id="transcript-text" rows={8} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="transcript-file">Transcript file</label>
            <span className="hint">WebVTT (.vtt) or SubRip (.srt) keep timings, so you can jump to each passage. Text (.txt) also works.</span>
            <input
              id="transcript-file"
              type="file"
              accept=".vtt,.srt,.txt,text/vtt,text/plain,application/x-subrip"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        )}
        {replacing && <p className="muted small">This replaces the current transcript. Highlights stay linked to passage numbers.</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button" data-variant={canTranscribe ? "secondary" : undefined} disabled={pending || (mode === "paste" ? !text.trim() : !file)}>
          {pending ? "Saving…" : replacing ? "Replace transcript" : "Save transcript"}
        </button>
      </form>
    </div>
  );
}
