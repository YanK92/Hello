"use client";

import { CaseView } from "@/components/case-view";
import { StartWizard, type WizardData } from "@/app/start/start-wizard";
import { Timeline } from "@/components/timeline/timeline";
import { CaseTabs } from "@/components/case-tabs";
import { RecordingsView } from "@/app/cases/[id]/recordings/recordings-view";
import { RecordingDetailView } from "@/app/cases/[id]/recordings/[evidenceId]/recording-detail-view";
import { SarDetailView, SarListView } from "@/app/cases/[id]/sar/sar-views";
import { SarWizard } from "@/components/sar/sar-wizard";
import {
  SAMPLE_NOW,
  SAMPLE_USER,
  sampleCase,
  sampleRecordingDetail,
  sampleRecordings,
  sampleRevisions,
  sampleSarDetail,
  sampleSars,
  sampleSarValues,
} from "../samples";

const ITEM = "2019 Ford Focus, AB19 CDE";
const WHAT =
  "Engine warning light came on and the car lost power on the A40. Pulled over safely. Bought from the dealer 3 weeks ago.";

function wizardData(extra: Partial<WizardData> = {}): Partial<WizardData> {
  return { item: ITEM, whatHappened: WHAT, occurredAtLocal: "2026-10-14T15:35", ...extra };
}

function sampleFiles() {
  const make = (name: string, type: string, kb: number) => new File([new Uint8Array(kb * 1024)], name, { type });
  return [make("dashboard-warning-light.jpg", "image/jpeg", 2420), make("odometer.jpg", "image/jpeg", 1910)];
}

export function PreviewScreen({ screen }: { screen: string }) {
  switch (screen) {
    case "wizard-1-item":
      return <WizardPage step={0} data={{}} />;
    case "wizard-2-what":
      return <WizardPage step={1} data={wizardData()} />;
    case "wizard-3-where":
      return <WizardPage step={2} data={wizardData()} />;
    case "wizard-3-where-recorded":
      return (
        <WizardPage
          step={2}
          data={wizardData({ location: { source: "device", lat: 51.785123, lng: -1.484567, accuracy: 8 } })}
        />
      );
    case "wizard-3-where-manual":
      return (
        <WizardPage step={2} data={wizardData({ location: { source: "manual", label: "Layby on the A40 near Witney" } })} />
      );
    case "wizard-4-photos":
      return <WizardPage step={3} data={wizardData({ files: sampleFiles() })} />;
    case "case":
      return (
        <div className="stack">
          <CaseView data={sampleCase} userId={SAMPLE_USER} />
        </div>
      );
    case "timeline":
      return <TimelinePage />;
    case "timeline-day-count":
      return <TimelinePage preview={{ selected: ["e0", "e1"] }} />;
    case "timeline-filtered":
      return <TimelinePage preview={{ filter: { types: ["communication", "check_in"], text: "", withFilesOnly: false } }} />;
    case "timeline-add":
      return (
        <TimelinePage
          preview={{
            adding: {
              type: "communication",
              title: "Email from the dealer with inspection date",
              occurredAtLocal: "2026-10-14T16:10",
              who: "Sam, service desk",
              evidenceIds: ["v3"],
            },
          }}
        />
      );
    case "timeline-history":
      return <TimelinePage preview={{ openPanel: { id: "e3", panel: "history", revisions: sampleRevisions } }} />;
    case "recordings-notice":
      return (
        <div className="stack">
          <RecordingsView caseId={sampleCase.id} title={sampleCase.title} userId={SAMPLE_USER} acknowledged={false} recordings={[]} />
        </div>
      );
    case "recordings":
      return (
        <div className="stack">
          <RecordingsView
            caseId={sampleCase.id}
            title={sampleCase.title}
            userId={SAMPLE_USER}
            acknowledged
            recordings={sampleRecordings}
            previewSearch={{
              query: "inspection",
              hits: [
                {
                  evidenceId: "r1",
                  headline:
                    "We can book it in for an <mark>inspection</mark> next Tuesday at nine … Can you confirm the <mark>inspection</mark> by email",
                },
              ],
            }}
          />
        </div>
      );
    case "recording-transcript":
      return (
        <div className="stack">
          <RecordingDetailView caseId={sampleCase.id} recording={sampleRecordingDetail(true)} canTranscribe={false} />
        </div>
      );
    case "recording-highlighting":
      return (
        <div className="stack">
          <RecordingDetailView
            caseId={sampleCase.id}
            recording={sampleRecordingDetail(true)}
            canTranscribe={false}
            preview={{ find: "email", range: [4, 5] }}
          />
        </div>
      );
    case "recording-import":
      return (
        <div className="stack">
          <RecordingDetailView caseId={sampleCase.id} recording={sampleRecordingDetail(false)} canTranscribe={false} />
        </div>
      );
    case "sar-list":
      return (
        <div className="stack">
          <SarListView caseId={sampleCase.id} title={sampleCase.title} sars={sampleSars} remindersOn now={SAMPLE_NOW} />
        </div>
      );
    case "sar-wizard-recipient":
    case "sar-wizard-information":
    case "sar-wizard-details":
    case "sar-wizard-review": {
      const step = ["recipient", "information", "details", "review"].indexOf(screen.replace("sar-wizard-", ""));
      return (
        <div className="stack">
          <h1>Prepare a data request</h1>
          <SarWizard caseId={sampleCase.id} contacts={[]} initial={sampleSarValues} initialStep={step} />
        </div>
      );
    }
    case "sar-detail-draft":
      return (
        <div className="stack">
          <SarDetailView caseId={sampleCase.id} userId={SAMPLE_USER} sar={sampleSarDetail("draft")} now={SAMPLE_NOW} />
        </div>
      );
    case "sar-detail-sent":
      return (
        <div className="stack">
          <SarDetailView caseId={sampleCase.id} userId={SAMPLE_USER} sar={sampleSarDetail("sent")} now={SAMPLE_NOW} />
        </div>
      );
    case "sar-detail-responded":
      return (
        <div className="stack">
          <SarDetailView caseId={sampleCase.id} userId={SAMPLE_USER} sar={sampleSarDetail("responded")} now={SAMPLE_NOW} />
        </div>
      );
    default:
      return <p>Unknown screen.</p>;
  }
}

function TimelinePage({ preview }: { preview?: Parameters<typeof Timeline>[0]["preview"] }) {
  return (
    <div className="stack">
      <h1>{sampleCase.title}</h1>
      <CaseTabs caseId={sampleCase.id} active="timeline" />
      <Timeline caseId={sampleCase.id} entries={sampleCase.entries} evidence={sampleCase.evidence} preview={preview} />
    </div>
  );
}

function WizardPage({ step, data }: { step: number; data: Partial<WizardData> }) {
  return (
    <div className="stack">
      <div>
        <h1>Something has gone wrong</h1>
        <p className="muted">
          Record the basics now, while they are fresh. It takes about two minutes, and you can add more later.
        </p>
      </div>
      <StartWizard initialStep={step} initialData={data} />
    </div>
  );
}
