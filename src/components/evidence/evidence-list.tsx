import { formatBytes } from "@/lib/evidence/rules";
import { formatTimestamp } from "@/lib/format";
import { IntegrityBadge, type IntegrityState } from "./integrity-badge";
import { RecheckButton } from "./recheck-button";

export interface EvidenceItem extends IntegrityState {
  id: string;
  name: string;
  mime: string;
  size: number;
  sha256: string;
  uploadedAt: string;
  /** Short-lived signed URL for a thumbnail, for images only. */
  thumbUrl: string | null;
}

export function EvidenceList({ items }: { items: EvidenceItem[] }) {
  if (!items.length) return <p className="muted">No files yet.</p>;

  return (
    <ul className="evidence-list">
      {items.map((item) => (
        <li key={item.id} className="card evidence-item">
          <div className="evidence-thumb" aria-hidden>
            {item.thumbUrl ? (
              // Signed storage URLs expire, so next/image caching is not wanted here.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.thumbUrl} alt="" loading="lazy" />
            ) : (
              <span className="evidence-thumb-label">{item.mime === "application/pdf" ? "PDF" : "FILE"}</span>
            )}
          </div>
          <div className="evidence-body">
            <strong className="evidence-name">{item.name}</strong>
            <span className="muted small">
              {formatBytes(item.size)} · Uploaded {formatTimestamp(item.uploadedAt)}
            </span>
            <IntegrityBadge {...item} />
            <details className="small">
              <summary>SHA-256 fingerprint</summary>
              <code className="hash">{item.sha256}</code>
            </details>
            <RecheckButton evidenceId={item.id} />
          </div>
        </li>
      ))}
    </ul>
  );
}
