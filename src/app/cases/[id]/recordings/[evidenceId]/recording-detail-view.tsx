import Link from "next/link";
import { IntegrityBadge } from "@/components/evidence/integrity-badge";
import { ImportTranscript } from "@/components/recordings/import-transcript";
import { TranscriptView } from "@/components/recordings/transcript-view";
import type { RecordingDetail } from "@/lib/cases/recordings";
import { formatBytes } from "@/lib/evidence/rules";
import { formatDateTime, formatTimestamp } from "@/lib/format";

export function RecordingDetailView({
  caseId,
  recording,
  canTranscribe,
  preview,
}: {
  caseId: string;
  recording: RecordingDetail;
  canTranscribe: boolean;
  preview?: { find?: string; range?: [number, number] };
}) {
  const t = recording.transcript;
  return (
    <>
      <p>
        <Link href={`/cases/${caseId}/recordings`}>← Recordings</Link>
      </p>
      <h1 className="break">{recording.name}</h1>
      <div className="card stack-sm">
        <span className="muted small">
          {formatBytes(recording.size)} · Uploaded {formatTimestamp(recording.uploadedAt)}
        </span>
        <IntegrityBadge {...recording} />
        <details className="small">
          <summary>SHA-256 fingerprint</summary>
          <code className="hash">{recording.sha256}</code>
        </details>
      </div>

      {t?.status === "done" ? (
        <>
          <p className="muted small">
            {t.source === "import" ? "Transcript imported" : `Transcribed by ${t.model ?? "provider"}`}{" "}
            {formatDateTime(t.updatedAt)}. Check it against the recording; transcripts can contain mistakes.
          </p>
          <TranscriptView
            transcriptId={t.id}
            segments={t.segments}
            highlights={recording.highlights}
            audioUrl={recording.audioUrl}
            initialFind={preview?.find}
            initialRange={preview?.range}
          />
          <details className="card">
            <summary>Replace the transcript</summary>
            <ImportTranscript evidenceId={recording.id} canTranscribe={canTranscribe} replacing />
          </details>
        </>
      ) : (
        <>
          {recording.audioUrl && (
            <audio className="audio-player" controls preload="metadata" src={recording.audioUrl}>
              Your browser cannot play this recording.
            </audio>
          )}
          <section className="card stack-sm" aria-labelledby="transcript-heading">
            <h2 id="transcript-heading" className="card-title">
              Transcript
            </h2>
            {t?.status === "processing" && <p className="muted">Transcribing… refresh in a minute.</p>}
            {t?.status === "failed" && <p className="error">{t.error ?? "Transcription failed."}</p>}
            <ImportTranscript evidenceId={recording.id} canTranscribe={canTranscribe} />
          </section>
        </>
      )}
    </>
  );
}
