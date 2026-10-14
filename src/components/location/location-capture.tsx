"use client";

import { useState } from "react";
import type { LocationValue } from "@/lib/validation/evidence";

type Mode = "idle" | "locating" | "manual";

/**
 * Asks the device for its location, with a typed-in fallback when
 * permission is refused or unavailable. Reports the value via onChange.
 */
export function LocationCapture({
  value,
  onChange,
}: {
  value: LocationValue | null;
  onChange: (value: LocationValue | null) => void;
}) {
  const [mode, setMode] = useState<Mode>(value?.source === "manual" ? "manual" : "idle");
  const [problem, setProblem] = useState<string | null>(null);

  function useDevice() {
    if (!("geolocation" in navigator)) {
      setProblem("This device cannot share its location. Type it instead.");
      setMode("manual");
      return;
    }
    setMode("locating");
    setProblem(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          source: "device",
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null,
        });
        setMode("idle");
      },
      (err) => {
        setProblem(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was not given. You can type where you are instead."
            : "Your location could not be found. You can type where you are instead.",
        );
        setMode("manual");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  if (value?.source === "device") {
    return (
      <div className="location-result">
        <p>
          <strong>Location recorded</strong>
          <br />
          <span className="muted small">
            {value.lat}, {value.lng}
            {value.accuracy != null && ` (within about ${value.accuracy} m)`}
          </span>
        </p>
        <button type="button" className="link-button" onClick={() => onChange(null)}>
          Remove location
        </button>
      </div>
    );
  }

  return (
    <div className="stack-sm">
      {mode !== "manual" && (
        <button type="button" className="button" onClick={useDevice} disabled={mode === "locating"}>
          {mode === "locating" ? "Finding your location…" : "Use my current location"}
        </button>
      )}
      {problem && (
        <p className="muted small" role="status">
          {problem}
        </p>
      )}
      {mode === "manual" ? (
        <div className="field">
          <label htmlFor="location-label">Where are you?</label>
          <input
            id="location-label"
            type="text"
            maxLength={300}
            placeholder="For example: layby on the A40 near Witney"
            value={value?.source === "manual" ? value.label : ""}
            onChange={(e) =>
              onChange(e.target.value.trim() ? { source: "manual", label: e.target.value } : null)
            }
          />
        </div>
      ) : (
        <button type="button" className="link-button" onClick={() => setMode("manual")}>
          Type the location instead
        </button>
      )}
    </div>
  );
}
