import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isUuid, requireCaseSummary } from "@/lib/cases/guard";
import { loadRecording } from "@/lib/cases/recordings";
import { transcriptionAvailable } from "@/lib/transcripts/provider";
import { RecordingDetailView } from "./recording-detail-view";

export const metadata: Metadata = { title: "Recording" };

async function Recording({ params }: { params: Promise<{ id: string; evidenceId: string }> }) {
  const { id, evidenceId } = await params;
  const { caseId } = await requireCaseSummary(id, `/recordings/${evidenceId}`);
  if (!isUuid(evidenceId)) notFound();
  const recording = await loadRecording(caseId, evidenceId);
  if (!recording) notFound();
  return <RecordingDetailView caseId={caseId} recording={recording} canTranscribe={transcriptionAvailable()} />;
}

export default function RecordingPage({ params }: PageProps<"/cases/[id]/recordings/[evidenceId]">) {
  return (
    <div className="stack">
      <Suspense fallback={<p className="muted">Loading recording…</p>}>
        <Recording params={params} />
      </Suspense>
    </div>
  );
}
