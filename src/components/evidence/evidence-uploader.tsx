"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { AUDIO_MIME_TYPES, DOCUMENT_MIME_TYPES } from "@/lib/evidence/rules";
import { uploadEvidenceFile, type UploadTarget } from "@/lib/evidence/upload";

type Status = "hashing" | "done" | "failed";

interface Row {
  key: string;
  name: string;
  status: Status;
  detail?: string;
}

/** Picks photos or documents and uploads each with its SHA-256 fingerprint. */
export function EvidenceUploader({
  target,
  onDone,
  kind = "documents",
}: {
  target: UploadTarget;
  onDone?: () => void;
  /** "audio" for call recordings; "documents" for photos and PDFs. */
  kind?: "documents" | "audio";
}) {
  const allowed = kind === "audio" ? AUDIO_MIME_TYPES : DOCUMENT_MIME_TYPES;
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const id = useId();

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const list = Array.from(files);
    const keys = list.map((f, i) => `${Date.now()}-${i}-${f.name}`);
    setRows((r) => [...list.map((f, i) => ({ key: keys[i], name: f.name, status: "hashing" as Status })), ...r]);

    for (const [i, file] of list.entries()) {
      const result = await uploadEvidenceFile(file, target, allowed);
      setRows((r) =>
        r.map((row) =>
          row.key === keys[i]
            ? result.ok
              ? { ...row, status: "done", detail: `Fingerprint ${result.sha256.slice(0, 12)}…` }
              : { ...row, status: "failed", detail: result.error }
            : row,
        ),
      );
    }
    setBusy(false);
    if (cameraRef.current) cameraRef.current.value = "";
    if (filesRef.current) filesRef.current.value = "";
    router.refresh();
    onDone?.();
  }

  return (
    <div className="stack-sm">
      <div className="button-row">
        {kind === "documents" && (
          <>
            <label className="button" htmlFor={`${id}-camera`} aria-disabled={busy}>
              Take a photo
            </label>
            <input
              ref={cameraRef}
              id={`${id}-camera`}
              className="visually-hidden"
              type="file"
              accept="image/*"
              capture="environment"
              disabled={busy}
              onChange={(e) => handle(e.target.files)}
            />
          </>
        )}
        <label
          className="button"
          data-variant={kind === "documents" ? "secondary" : undefined}
          htmlFor={`${id}-files`}
          aria-disabled={busy}
        >
          {kind === "audio" ? "Add a recording" : "Add files"}
        </label>
        <input
          ref={filesRef}
          id={`${id}-files`}
          className="visually-hidden"
          type="file"
          accept={kind === "audio" ? ["audio/*", ...allowed].join(",") : allowed.join(",")}
          multiple
          disabled={busy}
          onChange={(e) => handle(e.target.files)}
        />
      </div>
      <p className="muted small">
        {kind === "audio"
          ? "MP3, M4A, AAC, WAV, WebM or Ogg, up to 100 MB."
          : "Photos and PDFs up to 25 MB."}{" "}
        Each file gets a SHA-256 fingerprint before upload.
      </p>
      <UploadRows rows={rows} />
    </div>
  );
}

const STATUS_TEXT: Record<Status, string> = {
  hashing: "Fingerprinting and uploading…",
  done: "Saved and verified",
  failed: "Not saved",
};

export function UploadRows({ rows }: { rows: Row[] }) {
  if (!rows.length) return null;
  return (
    <ul className="upload-rows" aria-live="polite">
      {rows.map((row) => (
        <li key={row.key} data-status={row.status}>
          <span className="upload-name">{row.name}</span>
          <span className="small">
            {STATUS_TEXT[row.status]}
            {row.detail && ` · ${row.detail}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
