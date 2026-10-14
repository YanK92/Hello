"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acknowledgeRecordingNotice } from "@/app/cases/recording-actions";

/** Plain-language note shown before the first recording upload. */
export function RecordingNotice({ acknowledged, preview = false }: { acknowledged: boolean; preview?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (acknowledged) {
    return (
      <p className="muted small">
        Reminder: tell the other person at the start of a call that you are recording it.
      </p>
    );
  }

  return (
    <section className="card notice-card stack-sm" aria-labelledby="recording-notice-heading">
      <h2 id="recording-notice-heading" className="card-title">
        Before you add call recordings
      </h2>
      <ul className="notice-list">
        <li>Tell the other person at the start of the call that you are recording it.</li>
        <li>Recordings contain other people&apos;s voices and personal information. They are stored privately in your account.</li>
        <li>
          For what the rules say about recording calls and personal data, see the{" "}
          <a href="https://ico.org.uk/for-the-public/" target="_blank" rel="noreferrer">
            Information Commissioner&apos;s Office (ICO)
          </a>
          .
        </li>
      </ul>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="button"
        disabled={pending || preview}
        onClick={() =>
          startTransition(async () => {
            const result = await acknowledgeRecordingNotice();
            if (result.ok) router.refresh();
            else setError(result.error);
          })
        }
      >
        I have read this
      </button>
    </section>
  );
}
