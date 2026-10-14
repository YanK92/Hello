import Link from "next/link";
import { CaseTabs } from "@/components/case-tabs";
import { EvidenceList } from "@/components/evidence/evidence-list";
import { EvidenceUploader } from "@/components/evidence/evidence-uploader";
import { CheckInCard } from "@/components/location/check-in-card";
import { TimelineEntryCard } from "@/components/timeline/timeline-entry-card";
import type { CaseData } from "@/lib/cases/load";
import { formatDateTime } from "@/lib/format";

const RECENT = 3;

/** The case overview body. Used by the real page and the dev preview. */
export function CaseView({ data, userId }: { data: CaseData; userId: string }) {
  const recent = [...data.entries].reverse().slice(0, RECENT);
  const details = [...data.details, ["Started", formatDateTime(data.createdAt)] as [string, string]];

  return (
    <>
      <h1>{data.title}</h1>
      <CaseTabs caseId={data.id} active="overview" />
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
        <EvidenceUploader target={{ userId, caseId: data.id, eventId: null }} />
      </section>

      <CheckInCard caseId={data.id} />

      <div className="section-head">
        <h2>Latest entries</h2>
        <Link href={`/cases/${data.id}/timeline`}>Full timeline ({data.entries.length})</Link>
      </div>
      {recent.length ? (
        <ol className="entry-list">
          {recent.map((entry) => (
            <TimelineEntryCard key={entry.id} entry={entry} caseId={data.id} caseEvidence={data.evidence} readOnly />
          ))}
        </ol>
      ) : (
        <p className="muted">No entries yet.</p>
      )}

      <h2>Files ({data.evidence.length})</h2>
      <EvidenceList items={data.evidence} />
    </>
  );
}
