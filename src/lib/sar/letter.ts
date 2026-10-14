import { formatLongDate } from "./letter-dates";

export { formatLongDate };

// Neutral subject access request letter. The user chooses the recipient,
// what is asked for and how to receive it; nothing here argues, predicts or
// characterises anyone. Solicitor review required before public launch.

export const SAR_CATEGORIES = {
  all: "All the personal data you hold about me",
  calls: "Recordings and notes of telephone calls with me",
  correspondence: "Emails, letters, texts and other messages sent to me, received from me, or about me",
  account: "Account records, including notes and records of contact made on my account",
  goods: "Records about the vehicle or goods, including inspection, repair and diagnostic records",
  credit: "Records of any credit, affordability or identity checks about me",
  complaints: "Records about any complaint I have made",
  article15:
    "The supplementary information listed in Article 15(1) UK GDPR: the purposes of processing, the categories of personal data, the recipients, how long the data will be kept, where the data came from, and whether automated decision-making is used",
} as const;

export type SarCategory = keyof typeof SAR_CATEGORIES;

export interface SarLetterInput {
  /** Letter date, YYYY-MM-DD. */
  date: string;
  recipient: { name: string; address: string; email: string };
  categories: SarCategory[];
  dateRange: { from: string | null; to: string | null };
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


function rangeText({ from, to }: SarLetterInput["dateRange"]): string | null {
  if (from && to) return `covering the period from ${formatLongDate(from)} to ${formatLongDate(to)}`;
  if (from) return `covering the period from ${formatLongDate(from)} onwards`;
  if (to) return `covering the period up to ${formatLongDate(to)}`;
  return null;
}

export function buildSarLetter(input: SarLetterInput): { subject: string; body: string } {
  const { recipient, requester } = input;
  const lines: string[] = [];
  const blank = () => lines.push("");

  lines.push(recipient.name.trim());
  if (recipient.address.trim()) lines.push(...recipient.address.trim().split("\n").map((l) => l.trim()));
  blank();
  lines.push(formatLongDate(input.date));
  blank();
  lines.push("Dear Data Protection Officer,");
  blank();
  lines.push("Subject access request");
  blank();
  lines.push("I am making a subject access request under Article 15 of the UK General Data Protection Regulation.");
  blank();
  const range = rangeText(input.dateRange);
  lines.push(range ? `Please provide the following, ${range}:` : "Please provide the following:");
  const categories = input.categories.length ? input.categories : (["all"] as SarCategory[]);
  for (const c of categories) lines.push(`- ${SAR_CATEGORIES[c]}`);
  blank();
  lines.push("To help you find my information, my details are:");
  const details: [string, string][] = [
    ["Name", requester.fullName],
    ["Address", requester.address.trim().split("\n").map((l) => l.trim()).filter(Boolean).join(", ")],
    ["Email", requester.email],
    ["Phone", requester.phone],
    ...requester.references.map((r) => [r.label, r.value] as [string, string]),
  ];
  for (const [label, value] of details) if (label.trim() && value.trim()) lines.push(`${label.trim()}: ${value.trim()}`);
  if (requester.other.trim()) {
    blank();
    lines.push(requester.other.trim());
  }
  blank();
  lines.push(
    input.format === "electronic" && requester.email.trim()
      ? `I would like to receive this information electronically, by email to ${requester.email.trim()}.`
      : "I would like to receive this information as paper copies by post to the address above.",
  );
  blank();
  lines.push("Yours faithfully,");
  lines.push(requester.fullName.trim());

  return { subject: `Subject access request: ${requester.fullName.trim()}`, body: lines.join("\n") };
}

export function mailtoLink(to: string, subject: string, body: string): string {
  const enc = (s: string) => encodeURIComponent(s.replace(/\r?\n/g, "\r\n"));
  return `mailto:${to}?subject=${enc(subject)}&body=${enc(body)}`;
}
