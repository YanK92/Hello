import { EntryList, type Entry } from "@/components/entries/entry-list";
import { EvidenceList, type EvidenceItem } from "@/components/evidence/evidence-list";
import { EvidenceUploader } from "@/components/evidence/evidence-uploader";
import { CheckInCard } from "@/components/location/check-in-card";
import type { UploadTarget } from "@/lib/evidence/upload";

export interface CaseViewProps {
  title: string;
  details: [label: string, value: string | null][];
  entries: Entry[];
  items: EvidenceItem[];
  uploadTarget: UploadTarget;
}

/** The case page body. Used by the real page and the dev preview. */
export function CaseView({ title, details, entries, items, uploadTarget }: CaseViewProps) {
  return (
    <>
      <h1>{title}</h1>
      <dl className="details card">
        {details
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <div key={label} style={{ display: "contents" }}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>

      <section className="card stack-sm" aria-labelledby="add-evidence-heading">
        <h2 id="add-evidence-heading" className="card-title">
          Add evidence
        </h2>
        <EvidenceUploader target={uploadTarget} />
      </section>

      <CheckInCard caseId={uploadTarget.caseId} />

      <h2>Entries</h2>
      <EntryList entries={entries} />

      <h2>Files ({items.length})</h2>
      <EvidenceList items={items} />
    </>
  );
}
