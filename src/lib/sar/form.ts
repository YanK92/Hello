import { z } from "zod";
import { SAR_CATEGORIES, type SarCategory, type SarLetterInput } from "./letter";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a full date.");
const optionalDate = z.union([date, z.literal("")]).optional().transform((v) => v || null);
const text = (max: number) => z.string().trim().max(max).optional().default("");

export const sarFormSchema = z
  .object({
    recipient: z.object({
      contactId: z.uuid().nullable().optional().default(null),
      name: z.string().trim().min(1, "Add who the request is to.").max(300),
      address: text(1000),
      email: z.union([z.email("Check the recipient's email address."), z.literal("")]).optional().default(""),
      save: z.boolean().optional().default(false),
    }),
    categories: z
      .array(z.enum(Object.keys(SAR_CATEGORIES) as [SarCategory, ...SarCategory[]]))
      .min(1, "Tick at least one kind of information."),
    dateFrom: optionalDate,
    dateTo: optionalDate,
    format: z.enum(["electronic", "paper"]),
    requester: z.object({
      fullName: z.string().trim().min(1, "Add your full name.").max(200),
      address: text(1000),
      email: z.union([z.email("Check your email address."), z.literal("")]).optional().default(""),
      phone: text(50),
      references: z
        .array(z.object({ label: text(100), value: text(200) }))
        .max(6)
        .optional()
        .default([]),
      other: text(2000),
    }),
  })
  .refine((v) => !(v.dateFrom && v.dateTo) || v.dateTo >= v.dateFrom, {
    message: "The end date is before the start date.",
    path: ["dateTo"],
  })
  .refine((v) => v.format === "paper" || v.requester.email, {
    message: "Add your email address to receive the information electronically.",
    path: ["requester", "email"],
  })
  .refine((v) => v.format === "electronic" || v.requester.address, {
    message: "Add your postal address to receive paper copies.",
    path: ["requester", "address"],
  });

export type SarFormInput = z.input<typeof sarFormSchema>;
export type SarForm = z.output<typeof sarFormSchema>;

export function letterInput(form: SarForm, date: string): SarLetterInput {
  return {
    date,
    recipient: { name: form.recipient.name, address: form.recipient.address, email: form.recipient.email },
    categories: form.categories,
    dateRange: { from: form.dateFrom, to: form.dateTo },
    format: form.format,
    requester: {
      ...form.requester,
      references: form.requester.references.filter((r) => r.label && r.value),
    },
  };
}

export const markSentSchema = z
  .object({
    sentOn: date,
    receivedOn: optionalDate,
    method: z.enum(["email", "post", "online_form", "other"]),
  })
  .refine((v) => !v.receivedOn || v.receivedOn >= v.sentOn, {
    message: "The received date cannot be before the sent date.",
    path: ["receivedOn"],
  });

export const responseSchema = z.object({
  receivedOn: date,
  description: text(5000),
});
