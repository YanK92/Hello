import { expect, test } from "@playwright/test";

// Day-1 Evidence Lock, on a phone: sign up, log what happened with location
// and a photo, and see the photo listed with a verified fingerprint.
// Needs the local Supabase stack (see sign-up-and-create-case.spec.ts).
test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase stack running");

test.use({
  geolocation: { latitude: 51.785123, longitude: -1.484567, accuracy: 8 },
  permissions: ["geolocation"],
});

test("log a breakdown with location, a photo and notes in under two minutes", async ({ page }) => {
  const email = `day1-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  await page.goto("/login?next=/start");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Something has gone wrong" })).toBeVisible();

  const started = Date.now();

  await page.getByLabel("What is the item?").fill("2019 Ford Focus, AB19 CDE");
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByLabel("What happened?").fill("Warning light came on and the car lost power on the A40.");
  await expect(page.getByLabel("When did it happen?")).not.toHaveValue("");
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByRole("button", { name: "Use my current location" }).click();
  await expect(page.getByText("Location recorded")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();

  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: "dashboard.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("not really a jpeg, but bytes are bytes"),
  });
  await expect(page.getByText("dashboard.jpg")).toBeVisible();
  await page.getByRole("button", { name: "Save case" }).click();

  await expect(page.getByRole("heading", { name: "2019 Ford Focus, AB19 CDE" })).toBeVisible({ timeout: 30_000 });
  expect(Date.now() - started).toBeLessThan(120_000);

  await expect(page.getByText("51.785123, -1.484567")).toBeVisible();
  await expect(page.getByText("dashboard.jpg")).toBeVisible();
  await expect(page.getByText("Fingerprint verified")).toBeVisible();

  // Re-checking the stored file still matches.
  await page.getByRole("button", { name: "Check again" }).click();
  await expect(page.getByText("Matches the fingerprint taken at upload.")).toBeVisible();
});

test("check-in with a typed location when location is not shared", async ({ browser }) => {
  const context = await browser.newContext({ permissions: [] });
  const page = await context.newPage();
  const email = `checkin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  await page.goto("/login?next=/cases/new");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel(/case title/i).fill("Sofa");
  await page.getByRole("button", { name: "Save case" }).click();
  await expect(page.getByRole("heading", { name: "Sofa" })).toBeVisible();

  await page.getByRole("button", { name: "Type the location instead" }).click();
  await page.getByLabel("Where are you?").fill("Outside the shop, High Street");
  await page.getByRole("button", { name: "Save check-in" }).click();
  await expect(page.getByText("Check-in saved with the server time.")).toBeVisible();
  await expect(page.getByText("📍 Outside the shop, High Street")).toBeVisible();
  await context.close();
});
