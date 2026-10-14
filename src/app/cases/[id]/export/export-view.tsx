import { CaseTabs } from "@/components/case-tabs";
import { UpgradeCard } from "@/components/upgrade-card";
import { formatBytes } from "@/lib/evidence/rules";

export interface ExportSummary {
  entries: number;
  files: number;
  bytes: number;
  transcripts: number;
  sars: number;
  tooLarge: boolean;
}

export function ExportView({
  caseId,
  title,
  summary,
  paid,
}: {
  caseId: string;
  title: string;
  summary: ExportSummary;
  paid: boolean;
}) {
  return (
    <>
      <h1>{title}</h1>
      <CaseTabs caseId={caseId} active="export" />
      <p className="muted">
        Download everything recorded in this case: a single indexed PDF to read or share, and a ZIP of the original
        files with a fingerprint manifest so anyone can check they are unchanged.
      </p>
      <section className="card stack-sm">
        <h2 className="card-title">What is included</h2>
        <ul className="notice-list small">
          <li>Cover page and index with page numbers</li>
          <li>Chronology: {summary.entries} entries, with recorded and edited times</li>
          <li>
            Files: {summary.files} ({formatBytes(summary.bytes)}), each with its SHA-256 fingerprint checked again at
            export; photos and PDFs reproduced
          </li>
          <li>Transcripts: {summary.transcripts}, with your highlights and notes</li>
          <li>Data requests log: {summary.sars} requests with dates and responses</li>
        </ul>
      </section>
      {!paid ? (
        <UpgradeCard feature="Case bundle export" />
      ) : summary.tooLarge ? (
        <p className="error">This case is too large to export in one go (over 400 MB of files).</p>
      ) : (
        <div className="button-row">
          <a className="button" href={`/cases/${caseId}/export/bundle`} download>
            Download bundle (PDF)
          </a>
          <a className="button" data-variant="secondary" href={`/cases/${caseId}/export/originals`} download>
            Download originals (ZIP)
          </a>
        </div>
      )}
      <p className="small muted">
        Large cases can take a minute to prepare. The bundle shows records as you entered them; Evidence Locker does not
        check whether content is accurate.
      </p>
    </>
  );
}
