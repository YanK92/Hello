"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveSarDraft } from "@/app/cases/sar-actions";
import { Steps } from "@/components/steps";
import type { Contact } from "@/lib/cases/sar";
import { todayInUk } from "@/lib/sar/dates";
import { letterInput, sarFormSchema } from "@/lib/sar/form";
import { buildSarLetter, SAR_CATEGORIES, type SarCategory } from "@/lib/sar/letter";

const STEPS = ["Recipient", "Information", "Your details", "Review"] as const;

export interface SarValues {
  recipient: { contactId: string | null; name: string; address: string; email: string; save: boolean };
  categories: SarCategory[];
  dateFrom: string;
  dateTo: string;
  format: "electronic" | "paper";
  requester: {
    fullName: string;
    address: string;
    email: string;
    phone: string;
    references: { label: string; value: string }[];
    other: string;
  };
}

/** Which step a validation issue belongs to, by its path. */
function stepFor(path: PropertyKey[]): number {
  const [head] = path;
  if (head === "recipient") return 0;
  if (head === "requester") return 2;
  return 1;
}

export function blankSarValues(defaults: { email: string; agreementReference: string }): SarValues {
  return {
    recipient: { contactId: null, name: "", address: "", email: "", save: true },
    categories: ["all", "article15"],
    dateFrom: "",
    dateTo: "",
    format: "electronic",
    requester: {
      fullName: "",
      address: "",
      email: defaults.email,
      phone: "",
      references: [
        { label: "Agreement or account number", value: defaults.agreementReference },
        { label: "Vehicle registration", value: "" },
      ],
      other: "",
    },
  };
}

export function SarWizard({
  caseId,
  contacts,
  initial,
  initialStep = 0,
  sarId,
}: {
  caseId: string;
  contacts: Contact[];
  initial: SarValues;
  initialStep?: number;
  /** Set when editing an existing draft. */
  sarId?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [values, setValues] = useState<SarValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setRecipient = (patch: Partial<SarValues["recipient"]>) =>
    setValues((v) => ({ ...v, recipient: { ...v.recipient, ...patch } }));
  const setRequester = (patch: Partial<SarValues["requester"]>) =>
    setValues((v) => ({ ...v, requester: { ...v.requester, ...patch } }));

  const parsed = sarFormSchema.safeParse(values);

  function next() {
    setError(null);
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => stepFor(i.path) <= step);
      if (issue) return setError(issue.message);
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveSarDraft(caseId, values, sarId);
      if (result.ok) router.push(`/cases/${caseId}/sar/${result.sarId}`);
      else setError(result.error);
    });
  }

  function toggleCategory(c: SarCategory) {
    setValues((v) => ({
      ...v,
      categories: v.categories.includes(c) ? v.categories.filter((x) => x !== c) : [...v.categories, c],
    }));
  }

  return (
    <div className="stack">
      <Steps labels={STEPS} step={step} />
      <div className="card stack">
        {step === 0 && (
          <>
            <div>
              <h2 className="card-title">Who is the request to?</h2>
              <p className="muted small">
                Organisations usually list a data protection contact in their privacy notice.
              </p>
            </div>
            {contacts.length > 0 && (
              <div className="field">
                <label htmlFor="sar-contact">Saved contacts</label>
                <select
                  id="sar-contact"
                  value={values.recipient.contactId ?? ""}
                  onChange={(e) => {
                    const c = contacts.find((x) => x.id === e.target.value);
                    setRecipient(
                      c
                        ? { contactId: c.id, name: c.name, address: c.address ?? "", email: c.email ?? "", save: false }
                        : { contactId: null },
                    );
                  }}
                >
                  <option value="">New recipient</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label htmlFor="sar-name">Organisation and contact name</label>
              <input
                id="sar-name"
                type="text"
                maxLength={300}
                placeholder="For example: Example Finance Ltd, Data Protection Officer"
                value={values.recipient.name}
                onChange={(e) => setRecipient({ name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="sar-address">
                Postal address <span className="muted">(optional)</span>
              </label>
              <textarea
                id="sar-address"
                rows={3}
                maxLength={1000}
                value={values.recipient.address}
                onChange={(e) => setRecipient({ address: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="sar-email">
                Email address <span className="muted">(optional)</span>
              </label>
              <input
                id="sar-email"
                type="email"
                maxLength={320}
                value={values.recipient.email}
                onChange={(e) => setRecipient({ email: e.target.value })}
              />
            </div>
            {!values.recipient.contactId && (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={values.recipient.save}
                  onChange={(e) => setRecipient({ save: e.target.checked })}
                />
                <span>Save this recipient to my contacts</span>
              </label>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <fieldset className="evidence-picker">
              <legend>What information are you asking for?</legend>
              {(Object.keys(SAR_CATEGORIES) as SarCategory[]).map((c) => (
                <label key={c} className="check-row align-start">
                  <input type="checkbox" checked={values.categories.includes(c)} onChange={() => toggleCategory(c)} />
                  <span>{SAR_CATEGORIES[c]}</span>
                </label>
              ))}
            </fieldset>
            <div className="two-col">
              <div className="field">
                <label htmlFor="sar-from">
                  From <span className="muted">(optional)</span>
                </label>
                <input id="sar-from" type="date" value={values.dateFrom} onChange={(e) => setValues({ ...values, dateFrom: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="sar-to">
                  To <span className="muted">(optional)</span>
                </label>
                <input id="sar-to" type="date" value={values.dateTo} onChange={(e) => setValues({ ...values, dateTo: e.target.value })} />
              </div>
            </div>
            <fieldset className="evidence-picker">
              <legend>How would you like to receive it?</legend>
              <label className="check-row">
                <input
                  type="radio"
                  name="sar-format"
                  checked={values.format === "electronic"}
                  onChange={() => setValues({ ...values, format: "electronic" })}
                />
                <span>Electronically, by email</span>
              </label>
              <label className="check-row">
                <input
                  type="radio"
                  name="sar-format"
                  checked={values.format === "paper"}
                  onChange={() => setValues({ ...values, format: "paper" })}
                />
                <span>Paper copies by post</span>
              </label>
            </fieldset>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <h2 className="card-title">Your details</h2>
              <p className="muted small">These help the organisation find your information. Add only what you are happy to share.</p>
            </div>
            <div className="field">
              <label htmlFor="sar-full-name">Full name</label>
              <input
                id="sar-full-name"
                type="text"
                autoComplete="name"
                maxLength={200}
                value={values.requester.fullName}
                onChange={(e) => setRequester({ fullName: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="sar-my-address">Your address</label>
              <textarea
                id="sar-my-address"
                rows={3}
                autoComplete="street-address"
                maxLength={1000}
                value={values.requester.address}
                onChange={(e) => setRequester({ address: e.target.value })}
              />
            </div>
            <div className="two-col">
              <div className="field">
                <label htmlFor="sar-my-email">Your email</label>
                <input
                  id="sar-my-email"
                  type="email"
                  autoComplete="email"
                  value={values.requester.email}
                  onChange={(e) => setRequester({ email: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="sar-my-phone">
                  Phone <span className="muted">(optional)</span>
                </label>
                <input
                  id="sar-my-phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={50}
                  value={values.requester.phone}
                  onChange={(e) => setRequester({ phone: e.target.value })}
                />
              </div>
            </div>
            {values.requester.references.map((ref, i) => (
              <div className="field" key={i}>
                <label htmlFor={`sar-ref-${i}`}>
                  {ref.label} <span className="muted">(optional)</span>
                </label>
                <input
                  id={`sar-ref-${i}`}
                  type="text"
                  maxLength={200}
                  value={ref.value}
                  onChange={(e) =>
                    setRequester({
                      references: values.requester.references.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)),
                    })
                  }
                />
              </div>
            ))}
            <div className="field">
              <label htmlFor="sar-other">
                Anything else that identifies you <span className="muted">(optional)</span>
              </label>
              <textarea
                id="sar-other"
                rows={2}
                maxLength={2000}
                placeholder="For example: a previous address, or a customer number"
                value={values.requester.other}
                onChange={(e) => setRequester({ other: e.target.value })}
              />
            </div>
          </>
        )}

        {step === 3 && parsed.success && (
          <>
            <div>
              <h2 className="card-title">Check the letter</h2>
              <p className="muted small">
                You can go back and change anything. Saving keeps it as a draft; you send it yourself.
              </p>
            </div>
            <pre className="letter">{buildSarLetter(letterInput(parsed.data, todayInUk())).body}</pre>
          </>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="button-row">
          {step > 0 && (
            <button type="button" className="button" data-variant="secondary" onClick={() => setStep(step - 1)} disabled={pending}>
              Back
            </button>
          )}
          {step === STEPS.length - 1 ? (
            <button type="button" className="button" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save draft"}
            </button>
          ) : (
            <button type="button" className="button" onClick={next}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
