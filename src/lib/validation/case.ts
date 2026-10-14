import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

export const newCaseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the case a short title.")
    .max(200, "Keep the title under 200 characters."),
  item_description: optionalText(2000),
  trader_name: optionalText(200),
  finance_provider: optionalText(200),
  agreement_reference: optionalText(200),
});

export type NewCase = z.infer<typeof newCaseSchema>;

/** Reads the new-case form. Missing fields become null, not empty strings. */
export function parseNewCase(form: FormData) {
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : null;
  };
  return newCaseSchema.safeParse({
    title: get("title") ?? "",
    item_description: get("item_description"),
    trader_name: get("trader_name"),
    finance_provider: get("finance_provider"),
    agreement_reference: get("agreement_reference"),
  });
}
