"use client";

import { CaseView } from "@/components/case-view";
import { StartWizard, type WizardData } from "@/app/start/start-wizard";
import { SAMPLE_CASE, SAMPLE_USER, sampleDetails, sampleEntries, sampleEvidence } from "../samples";

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
          <CaseView
            title={ITEM}
            details={sampleDetails}
            entries={sampleEntries}
            items={sampleEvidence}
            uploadTarget={{ userId: SAMPLE_USER, caseId: SAMPLE_CASE, eventId: null }}
          />
        </div>
      );
    default:
      return <p>Unknown screen.</p>;
  }
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
