"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { recheckEvidence } from "@/app/cases/evidence-actions";

export function RecheckButton({ evidenceId }: { evidenceId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <span className="inline-action">
      <button
        type="button"
        className="button"
        data-variant="secondary"
        data-size="small"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await recheckEvidence(evidenceId);
            setMessage(
              result.ok
                ? result.matches
                  ? "Matches the fingerprint taken at upload."
                  : "Does not match the fingerprint taken at upload."
                : result.error,
            );
            router.refresh();
          })
        }
      >
        {pending ? "Checking…" : "Check again"}
      </button>
      {message && (
        <span role="status" className="muted small">
          {message}
        </span>
      )}
    </span>
  );
}
