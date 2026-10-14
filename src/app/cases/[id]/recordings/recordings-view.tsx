import { CaseTabs } from "@/components/case-tabs";
import { EvidenceUploader } from "@/components/evidence/evidence-uploader";
import { RecordingList } from "@/components/recordings/recording-list";
import { RecordingNotice } from "@/components/recordings/recording-notice";
import { TranscriptSearch } from "@/components/recordings/transcript-search";
import type { TranscriptHit } from "@/app/cases/recording-actions";
import type { RecordingSummary } from "@/lib/cases/recordings";

/** Recordings tab body. Used by the real page and the dev preview. */
export function RecordingsView({
  caseId,
  title,
  userId,
  acknowledged,
  recordings,
  previewSearch,
}: {
  caseId: string;
  title: string;
  userId: string;
  acknowledged: boolean;
  recordings: RecordingSummary[];
  previewSearch?: { query: string; hits: TranscriptHit[] };
}) {
  const names = Object.fromEntries(recordings.map((r) => [r.id, r.name]));
  return (
    <>
      <h1>{title}</h1>
      <CaseTabs caseId={caseId} active="recordings" />
      <RecordingNotice acknowledged={acknowledged} preview={Boolean(previewSearch) || undefined} />
      {acknowledged && (
        <section className="card stack-sm" aria-labelledby="add-recording-heading">
          <h2 id="add-recording-heading" className="card-title">
            Add a call recording
          </h2>
          <EvidenceUploader kind="audio" target={{ userId, caseId, eventId: null }} />
        </section>
      )}
      {recordings.some((r) => r.transcriptStatus === "done") && (
        <TranscriptSearch caseId={caseId} names={names} initial={previewSearch} />
      )}
      <h2>Recordings ({recordings.length})</h2>
      <RecordingList caseId={caseId} recordings={recordings} />
    </>
  );
}
