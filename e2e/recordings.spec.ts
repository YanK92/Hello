import { expect, test } from "@playwright/test";

// Phase 3: upload a call recording, acknowledge the recording notice, import a
// timestamped transcript, search it, and highlight a passage with a note.
test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase stack running");

const VTT = `WEBVTT

00:00:00.000 --> 00:00:05.000
<v Me>Hello, I'm calling about my car.

00:00:05.000 --> 00:00:11.000
<v Dealer>We can book an inspection for next Tuesday.
`;

test("upload, transcribe by import, search and highlight a recording", async ({ page }) => {
  const email = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  await page.goto("/login?next=/cases/new");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel(/case title/i).fill("Car");
  await page.getByRole("button", { name: "Save case" }).click();
  await page.getByRole("link", { name: "Recordings" }).click();

  // The notice must be acknowledged before uploads are offered.
  await expect(page.getByText("Before you add call recordings")).toBeVisible();
  await page.getByRole("button", { name: "I have read this" }).click();
  await expect(page.getByText(/Reminder: tell the other person/)).toBeVisible();

  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: "dealer-call.m4a",
    mimeType: "audio/mp4",
    buffer: Buffer.from("pretend audio bytes"),
  });
  await expect(page.getByRole("link", { name: "dealer-call.m4a" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("No transcript yet")).toBeVisible();

  await page.getByRole("link", { name: "dealer-call.m4a" }).click();
  await page.getByRole("button", { name: "Upload a file" }).click();
  await page.getByLabel("Transcript file").setInputFiles({
    name: "call.vtt",
    mimeType: "text/vtt",
    buffer: Buffer.from(VTT),
  });
  await page.getByRole("button", { name: "Save transcript" }).click();
  await expect(page.getByRole("button", { name: "Play from 0:05" })).toBeVisible();

  // Highlight the dealer's passage with a note.
  const passage = page.locator("li.passage", { hasText: "inspection" });
  await passage.getByRole("button", { name: "Highlight" }).click();
  await page.getByLabel(/^Note/).fill("Date offered");
  await page.getByRole("button", { name: "Save highlight" }).click();
  await expect(page.getByText("Your highlights (1)")).toBeVisible();

  // Case-wide search finds it, with the match marked.
  await page.getByRole("link", { name: "← Recordings" }).click();
  await page.getByRole("searchbox", { name: "Words to find" }).fill("inspections");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.locator(".search-hits mark")).toHaveText(/inspection/i);
});
