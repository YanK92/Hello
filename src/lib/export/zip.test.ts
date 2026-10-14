import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "@/lib/integrity";
import { buildOriginalsZip } from "./zip";

describe("buildOriginalsZip", () => {
  it("contains the originals, a SHA256SUMS file, a CSV manifest and a README", async () => {
    const photo = new TextEncoder().encode("photo bytes");
    const zip = buildOriginalsZip({
      caseTitle: "Car",
      generatedAt: "2026-10-14T16:00:00Z",
      files: [
        {
          label: "F1",
          name: "dash, light.jpg",
          mime: "image/jpeg",
          size: photo.length,
          sha256: await sha256Hex(photo),
          uploadedAt: "2026-10-14T15:00:00Z",
          bytes: photo,
          exportSha256: await sha256Hex(photo),
        },
        {
          label: "F2",
          name: "gone.pdf",
          mime: "application/pdf",
          size: 9,
          sha256: "a".repeat(64),
          uploadedAt: "2026-10-14T15:01:00Z",
          bytes: null,
          exportSha256: null,
        },
      ],
    });
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(["README.txt", "SHA256SUMS", "manifest.csv", "originals/F1 dash_ light.jpg"]);
    expect(strFromU8(files["originals/F1 dash_ light.jpg"])).toBe("photo bytes");
    // sha256sum -c format: "<hash>  <path>"
    expect(strFromU8(files.SHA256SUMS)).toBe(`${await sha256Hex(photo)}  originals/F1 dash_ light.jpg\n`);
    const csv = strFromU8(files["manifest.csv"]).split("\n");
    expect(csv[0]).toBe("label,file_in_zip,original_name,type,size_bytes,uploaded_at,sha256_at_upload,sha256_at_export,check");
    expect(csv[1]).toContain('"dash, light.jpg"');
    expect(csv[1].endsWith(",matches")).toBe(true);
    expect(csv[2].endsWith(",not included: could not be read")).toBe(true);
    expect(strFromU8(files["README.txt"])).toContain("sha256sum -c SHA256SUMS");
  });
});
