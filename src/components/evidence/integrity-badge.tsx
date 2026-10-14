import { formatDateTime } from "@/lib/format";

export interface IntegrityState {
  hashVerifiedAt: string | null;
  lastCheckedAt: string | null;
  lastCheckOk: boolean | null;
}

/** Shows whether the stored file still matches the fingerprint taken at upload. */
export function IntegrityBadge({ hashVerifiedAt, lastCheckedAt, lastCheckOk }: IntegrityState) {
  const checked = lastCheckedAt ?? hashVerifiedAt;
  const [tone, label] =
    lastCheckOk === false
      ? (["danger", "⚠ Does not match fingerprint"] as const)
      : hashVerifiedAt
        ? (["success", "✓ Fingerprint verified"] as const)
        : (["neutral", "Not verified"] as const);

  return (
    <span className="integrity">
      <span className="badge" data-tone={tone}>
        {label}
      </span>
      {checked && tone !== "neutral" && <span className="muted small">Last checked {formatDateTime(checked)}</span>}
    </span>
  );
}
