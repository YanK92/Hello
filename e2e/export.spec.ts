import { createHash } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import { expect, test } from "@playwright/test";

// Phase 5: a full test case exports to an indexed PDF and a ZIP whose
// SHA256SUMS match the originals; the side-by-side viewer keeps user notes.
// Payments are off in CI (no STRIPE_PRICE_ID), so export is unlocked.
test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase stack running");

test("export a bundle and originals, and note documents side by side", async ({ page }) => {
  const email = `export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  await page.goto("/login?next=/cases/new");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel(/case title/i).fill("Car");
  await page.getByRole("button", { name: "Save case" }).click();

  const jpeg = (s: string) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(s)]);
  const a = jpeg("first document bytes");
  const b = jpeg("second document bytes");
  await page.locator('input[type="file"][multiple]').setInputFiles([
    { name: "a.jpg", mimeType: "image/jpeg", buffer: a },
    { name: "b.jpg", mimeType: "image/jpeg", buffer: b },
  ]);
  await expect(page.getByText("Files (2)")).toBeVisible({ timeout: 30_000 });

  // Compare: choose both and add a note.
  await page.getByRole("link", { name: "Compare" }).click();
  await page.getByLabel("First document").selectOption({ label: "a.jpg" });
  await page.getByLabel("Second document").selectOption({ label: "b.jpg" });
  await page.locator("section.pane").first().getByLabel("Note").fill("Taken at the roadside");
  await page.locator("section.pane").first().getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("Taken at the roadside")).toBeVisible();

  // Export.
  await page.getByRole("link", { name: "Export" }).click();
  const base = page.url();
  const pdf = await page.request.get(`${base}/bundle`);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  const zipRes = await page.request.get(`${base}/originals`);
  expect(zipRes.headers()["content-type"]).toBe("application/zip");
  const files = unzipSync(new Uint8Array(await zipRes.body()));
  const sums = strFromU8(files.SHA256SUMS).trim().split("\n");
  expect(sums).toHaveLength(2);
  for (const line of sums) {
    const [hash, path] = line.split("  ");
    expect(createHash("sha256").update(files[path]).digest("hex")).toBe(hash);
  }
  expect(strFromU8(files["manifest.csv"])).toContain(",matches");
});
