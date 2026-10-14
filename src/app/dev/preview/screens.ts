export const PREVIEW_SCREENS = [
  "wizard-1-item",
  "wizard-2-what",
  "wizard-3-where",
  "wizard-3-where-recorded",
  "wizard-3-where-manual",
  "wizard-4-photos",
  "case",
  "timeline",
  "timeline-day-count",
  "timeline-filtered",
  "timeline-add",
  "timeline-history",
  "recordings-notice",
  "recordings",
  "recording-transcript",
  "recording-highlighting",
  "recording-import",
  "sar-list",
  "sar-wizard-recipient",
  "sar-wizard-information",
  "sar-wizard-details",
  "sar-wizard-review",
  "sar-detail-draft",
  "sar-detail-sent",
  "sar-detail-responded",
  "export",
  "export-locked",
  "compare",
  "upgrade",
  "account",
] as const;

/** The preview uses sample data only, and is off in production builds. */
export function previewEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_PREVIEW === "1";
}
