import { strToU8, zipSync, type Zippable } from "fflate";
import { formatTimestamp } from "@/lib/format";
import { zipName } from "./bundle";

export interface ZipFileInput {
  label: string;
  name: string;
  mime: string;
  size: number;
  sha256: string;
  uploadedAt: string;
  bytes: Uint8Array | null;
  exportSha256: string | null;
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** ZIP of original files with a manifest that can be checked independently. */
export function buildOriginalsZip(input: { caseTitle: string; generatedAt: string; files: ZipFileInput[] }): Uint8Array {
  const entries: Zippable = {};
  const sums: string[] = [];
  const rows = [
    "label,file_in_zip,original_name,type,size_bytes,uploaded_at,sha256_at_upload,sha256_at_export,check",
  ];

  for (const f of input.files) {
    const path = `originals/${zipName(f)}`;
    let check: string;
    if (f.bytes) {
      // Files are stored as-is (already compressed formats mostly), level 0.
      entries[path] = [f.bytes, { level: 0 }];
      sums.push(`${f.sha256}  ${path}`);
      check = f.exportSha256 === f.sha256 ? "matches" : "DOES NOT MATCH";
    } else {
      check = "not included: could not be read";
    }
    rows.push(
      [f.label, f.bytes ? path : "", f.name, f.mime, f.size, f.uploadedAt, f.sha256, f.exportSha256 ?? "", check]
        .map(csvCell)
        .join(","),
    );
  }

  entries["SHA256SUMS"] = strToU8(sums.map((l) => `${l}\n`).join(""));
  entries["manifest.csv"] = strToU8(`${rows.join("\n")}\n`);
  entries["README.txt"] = strToU8(
    [
      `Original files for: ${input.caseTitle}`,
      `Exported ${formatTimestamp(input.generatedAt)} from Evidence Locker.`,
      "",
      "Each file was fingerprinted with SHA-256 when it was uploaded. SHA256SUMS lists",
      "those fingerprints. To check the files have not changed, run this in this folder:",
      "",
      "  sha256sum -c SHA256SUMS            (Linux)",
      "  shasum -a 256 -c SHA256SUMS        (macOS)",
      "",
      "On Windows, run `certutil -hashfile <file> SHA256` for each file and compare.",
      "",
      "manifest.csv lists every file with its upload time, its fingerprint at upload and",
      "at export, and the result of comparing them. The labels (F1, F2, ...) match the",
      "case bundle PDF.",
    ].join("\n"),
  );

  return zipSync(entries);
}
