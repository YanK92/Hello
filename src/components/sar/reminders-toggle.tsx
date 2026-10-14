"use client";

import { useState, useTransition } from "react";
import { setEmailReminders } from "@/app/cases/sar-actions";

export function RemindersToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="stack-sm">
      <label className="check-row">
        <input
          type="checkbox"
          checked={on}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setOn(next);
            startTransition(async () => {
              const result = await setEmailReminders(next);
              if (!result.ok) {
                setOn(!next);
                setError(result.error);
              }
            });
          }}
        />
        <span>Email me on the response date I recorded, and 7 days after</span>
      </label>
      {error && <p className="error small">{error}</p>}
    </div>
  );
}
