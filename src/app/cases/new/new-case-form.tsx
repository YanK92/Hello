"use client";

import { useActionState } from "react";
import { createCase, type CaseFormState } from "../actions";

function Field(props: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  multiline?: boolean;
  required?: boolean;
  maxLength: number;
}) {
  const { name, label, hint, error, multiline, required, maxLength } = props;
  const describedBy = [hint && `${name}-hint`, error && `${name}-error`].filter(Boolean).join(" ");
  const common = {
    id: name,
    name,
    required,
    maxLength,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
  };
  return (
    <div className="field">
      <label htmlFor={name}>
        {label}
        {!required && <span className="muted"> (optional)</span>}
      </label>
      {hint && (
        <span id={`${name}-hint`} className="hint">
          {hint}
        </span>
      )}
      {multiline ? <textarea {...common} /> : <input type="text" {...common} />}
      {error && (
        <span id={`${name}-error`} className="error">
          {error}
        </span>
      )}
    </div>
  );
}

export function NewCaseForm() {
  const [state, action, pending] = useActionState<CaseFormState, FormData>(createCase, {});
  const e = state.errors ?? {};

  return (
    <form action={action} className="card stack">
      <Field
        name="title"
        label="Case title"
        hint="A short name you will recognise, for example “Car gearbox fault”."
        error={e.title}
        required
        maxLength={200}
      />
      <Field
        name="item_description"
        label="What is the item?"
        hint="Make, model, registration or description, as you would describe it."
        error={e.item_description}
        multiline
        maxLength={2000}
      />
      <Field name="trader_name" label="Seller or trader" error={e.trader_name} maxLength={200} />
      <Field
        name="finance_provider"
        label="Finance provider"
        hint="Only if the item was bought on finance."
        error={e.finance_provider}
        maxLength={200}
      />
      <Field
        name="agreement_reference"
        label="Agreement or order reference"
        error={e.agreement_reference}
        maxLength={200}
      />
      {state.formError && (
        <p className="error" role="alert">
          {state.formError}
        </p>
      )}
      <button className="button" disabled={pending}>
        {pending ? "Saving…" : "Save case"}
      </button>
    </form>
  );
}
