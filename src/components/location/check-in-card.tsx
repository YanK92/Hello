"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addCheckIn } from "@/app/cases/evidence-actions";
import type { LocationValue } from "@/lib/validation/evidence";
import { LocationCapture } from "./location-capture";

/** Records "I am here now" as a check-in entry with a server timestamp. */
export function CheckInCard({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "notice"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!location) {
      setMessage({ tone: "error", text: "Add a location first." });
      return;
    }
    startTransition(async () => {
      const result = await addCheckIn({ caseId, notes, location });
      if (result.ok) {
        setLocation(null);
        setNotes("");
        setMessage({ tone: "notice", text: "Check-in saved with the server time." });
        router.refresh();
      } else {
        setMessage({ tone: "error", text: result.error });
      }
    });
  }

  return (
    <section className="card stack-sm" aria-labelledby="check-in-heading">
      <h2 id="check-in-heading" className="card-title">
        Check in
      </h2>
      <p className="muted small">Records where you are, timestamped by the server.</p>
      <LocationCapture value={location} onChange={setLocation} />
      <div className="field">
        <label htmlFor="check-in-notes">
          Note <span className="muted">(optional)</span>
        </label>
        <textarea
          id="check-in-notes"
          rows={2}
          maxLength={10000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {message && (
        <p className={message.tone} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}
      <button type="button" className="button" onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save check-in"}
      </button>
    </section>
  );
}
