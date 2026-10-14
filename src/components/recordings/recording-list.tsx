import Link from "next/link";
import { IntegrityBadge } from "@/components/evidence/integrity-badge";
import type { RecordingSummary, TranscriptStatus } from "@/lib/cases/recordings";
import { formatBytes } from "@/lib/evidence/rules";
import { formatTimestamp } from "@/lib/format";

const STATUS: Record<TranscriptStatus, string> = {
  none: "No transcript yet",
  pending: "Transcript queued",
  processing: "Transcribing…",
  done: "Transcript ready",
  failed: "Transcription failed",
};

export function RecordingList({ caseId, recordings }: { caseId: string; recordings: RecordingSummary[] }) {
  if (!recordings.length) return <p className="muted">No recordings yet.</p>;
  return (
    <ul className="evidence-list">
      {recordings.map((r) => (
        <li key={r.id} className="card recording-item">
          <div className="evidence-thumb" aria-hidden>
            <span className="evidence-thumb-label">AUDIO</span>
          </div>
          <div className="evidence-body">
            <Link href={`/cases/${caseId}/recordings/${r.id}`} className="evidence-name">
              {r.name}
            </Link>
            <span className="muted small">
              {formatBytes(r.size)} · Uploaded {formatTimestamp(r.uploadedAt)}
            </span>
            <IntegrityBadge {...r} />
            <span className="small" data-status={r.transcriptStatus}>
              {STATUS[r.transcriptStatus]}
              {r.transcriptStatus === "done" &&
                ` · ${r.segmentCount} passages${r.highlightCount ? ` · ${r.highlightCount} highlighted` : ""}`}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
