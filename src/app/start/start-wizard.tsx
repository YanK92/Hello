"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { UploadRows } from "@/components/evidence/evidence-uploader";
import { Steps } from "@/components/steps";
import { LocationCapture } from "@/components/location/location-capture";
import { formatBytes, rejectReason } from "@/lib/evidence/rules";
import { uploadEvidenceFile } from "@/lib/evidence/upload";
import { toDateTimeLocal } from "@/lib/format";
import type { LocationValue } from "@/lib/validation/evidence";
import { startCase } from "./actions";

export interface WizardData {
  item: string;
  whatHappened: string;
  occurredAtLocal: string;
  location: LocationValue | null;
  files: File[];
}

const STEPS = ["The item", "What happened", "Where you are", "Photos"] as const;

type UploadRow = Parameters<typeof UploadRows>[0]["rows"][number];

export function StartWizard({ initialStep = 0, initialData }: { initialStep?: number; initialData?: Partial<WizardData> }) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [data, setData] = useState<WizardData>({
    item: "",
    whatHappened: "",
    // Filled in on the device when the user reaches that step, so the
    // default is the phone's local time, not the server's.
    occurredAtLocal: "",
    location: null,
    files: [],
    ...initialData,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [savedCaseId, setSavedCaseId] = useState<string | null>(null);

  const update = (patch: Partial<WizardData>) => setData((d) => ({ ...d, ...patch }));

  function next() {
    setError(null);
    if (step === 0 && !data.item.trim()) return setError("Say what the item is.");
    if (step === 0 && !data.occurredAtLocal) update({ occurredAtLocal: toDateTimeLocal(new Date()) });
    if (step === 1 && !data.whatHappened.trim()) return setError("Say briefly what happened.");
    if (step === 1 && !data.occurredAtLocal) return setError("Add when it happened.");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function save() {
    setError(null);
    setSaving(true);
    const result = await startCase({
      item: data.item,
      whatHappened: data.whatHappened,
      occurredAt: new Date(data.occurredAtLocal).toISOString(),
      location: data.location,
    });
    if (!result.ok) {
      setSaving(false);
      setError(result.error);
      return;
    }

    setSavedCaseId(result.caseId);
    const keys = data.files.map((f, i) => `${i}-${f.name}`);
    setRows(data.files.map((f, i) => ({ key: keys[i], name: f.name, status: "hashing" })));
    let failures = 0;
    for (const [i, file] of data.files.entries()) {
      const outcome = await uploadEvidenceFile(file, {
        userId: result.userId,
        caseId: result.caseId,
        eventId: result.eventId,
      });
      if (!outcome.ok) failures++;
      setRows((r) =>
        r.map((row) =>
          row.key === keys[i]
            ? outcome.ok
              ? { ...row, status: "done", detail: `Fingerprint ${outcome.sha256.slice(0, 12)}…` }
              : { ...row, status: "failed", detail: outcome.error }
            : row,
        ),
      );
    }
    setSaving(false);
    // Stay on the summary if anything failed so the user can see what.
    if (failures === 0) router.push(`/cases/${result.caseId}`);
  }

  if (savedCaseId) {
    return (
      <div className="card stack-sm">
        <h2 className="card-title">Case saved</h2>
        <UploadRows rows={rows} />
        {!saving && (
          <Link href={`/cases/${savedCaseId}`} className="button">
            Open the case
          </Link>
        )}
      </div>
    );
  }

  const last = step === STEPS.length - 1;

  return (
    <div className="stack">
      <StepIndicator step={step} />
      <div className="card stack">
        {step === 0 && <ItemStep value={data.item} onChange={(item) => update({ item })} />}
        {step === 1 && (
          <WhatStep
            whatHappened={data.whatHappened}
            occurredAtLocal={data.occurredAtLocal}
            onChange={update}
          />
        )}
        {step === 2 && <WhereStep value={data.location} onChange={(location) => update({ location })} />}
        {step === 3 && <PhotosStep files={data.files} onChange={(files) => update({ files })} />}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="button-row">
          {step > 0 && (
            <button type="button" className="button" data-variant="secondary" onClick={() => setStep(step - 1)} disabled={saving}>
              Back
            </button>
          )}
          {last ? (
            <button type="button" className="button" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save case"}
            </button>
          ) : (
            <button type="button" className="button" onClick={next}>
              {step === 2 && !data.location ? "Skip" : "Next"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function StepIndicator({ step }: { step: number }) {
  return <Steps labels={STEPS} step={step} />;
}

export function ItemStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label htmlFor="item">What is the item?</label>
      <span className="hint">Make, model and registration, or a short description.</span>
      <textarea
        id="item"
        rows={2}
        maxLength={2000}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="For example: 2019 Ford Focus, AB19 CDE"
        autoFocus
      />
    </div>
  );
}

export function WhatStep({
  whatHappened,
  occurredAtLocal,
  onChange,
}: {
  whatHappened: string;
  occurredAtLocal: string;
  onChange: (patch: Partial<WizardData>) => void;
}) {
  return (
    <>
      <div className="field">
        <label htmlFor="what">What happened?</label>
        <span className="hint">In your own words. You can add more later.</span>
        <textarea
          id="what"
          rows={4}
          maxLength={10000}
          value={whatHappened}
          onChange={(e) => onChange({ whatHappened: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="when">When did it happen?</label>
        <input
          id="when"
          type="datetime-local"
          value={occurredAtLocal}
          onChange={(e) => onChange({ occurredAtLocal: e.target.value })}
        />
      </div>
    </>
  );
}

export function WhereStep({
  value,
  onChange,
}: {
  value: LocationValue | null;
  onChange: (v: LocationValue | null) => void;
}) {
  return (
    <>
      <div>
        <h2 className="card-title">Where are you?</h2>
        <p className="muted small">Optional. Your location is saved with this entry and only you can see it.</p>
      </div>
      <LocationCapture value={value} onChange={onChange} />
    </>
  );
}

export function PhotosStep({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const id = useId();
  const [problem, setProblem] = useState<string | null>(null);

  function add(list: FileList | null) {
    if (!list) return;
    const accepted: File[] = [];
    for (const f of Array.from(list)) {
      const reason = rejectReason(f);
      if (reason) setProblem(`${f.name}: ${reason}`);
      else accepted.push(f);
    }
    onChange([...files, ...accepted]);
  }

  return (
    <>
      <div>
        <h2 className="card-title">Photos and documents</h2>
        <p className="muted small">
          Optional. Each file gets a SHA-256 fingerprint and an upload time, so you can show it has not changed.
        </p>
      </div>
      <div className="button-row">
        <label className="button" htmlFor={`${id}-camera`}>
          Take a photo
        </label>
        <input
          id={`${id}-camera`}
          className="visually-hidden"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
        <label className="button" data-variant="secondary" htmlFor={`${id}-files`}>
          Add files
        </label>
        <input
          id={`${id}-files`}
          className="visually-hidden"
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {problem && (
        <p className="error small" role="alert">
          {problem}
        </p>
      )}
      {files.length > 0 && (
        <ul className="upload-rows">
          {files.map((f, i) => (
            <li key={`${i}-${f.name}`}>
              <span className="upload-name">{f.name}</span>
              <span className="small muted">{formatBytes(f.size)}</span>
              <button
                type="button"
                className="link-button small"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
