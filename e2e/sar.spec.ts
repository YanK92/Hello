import { expect, test } from "@playwright/test";

// Phase 4: prepare a SAR letter, download it as PDF, record it as sent (due
// date shown), log a response, and see both on the timeline.
test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase stack running");

test("prepare, send, track and log a response to a subject access request", async ({ page }) => {
  const email = `sar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  await page.goto("/login?next=/cases/new");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel(/case title/i).fill("Car");
  await page.getByLabel(/agreement or order reference/i).fill("AG-12345");
  await page.getByRole("button", { name: "Save case" }).click();
  await page.getByRole("link", { name: "Data requests" }).click();
  await page.getByRole("link", { name: "Prepare a request" }).click();

  await page.getByLabel("Organisation and contact name").fill("Example Finance Ltd");
  await page.getByLabel(/^Email address/).fill("dpo@example-finance.test");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel(SAR_CALLS).check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Full name").fill("Alex Taylor");
  await expect(page.getByLabel("Your email")).toHaveValue(email);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.locator("pre.letter")).toContainText("Agreement or account number: AG-12345");
  await page.getByRole("button", { name: "Save draft" }).click();

  await expect(page.getByText("Draft", { exact: true })).toBeVisible();
  const pdf = await page.request.get(`${page.url()}/letter`);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  await page.getByLabel("Date you sent it").fill(today);
  await page.getByRole("button", { name: "Record as sent" }).click();
  await expect(page.getByText(/Response due .* \(in \d+ days\)/)).toBeVisible();

  await page.getByText("Log a response").click();
  await page.getByLabel("Date received").fill(today);
  await page.getByLabel(/What was received/).fill("Account notes by email");
  await page.getByRole("button", { name: "Log response" }).click();
  await expect(page.getByText("Response logged. Add the files you received:")).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Response logged", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "← Data requests" }).click();
  await page.getByRole("link", { name: "Timeline" }).click();
  await expect(page.getByText("Subject access request sent to Example Finance Ltd")).toBeVisible();
  await expect(page.getByText("Response to subject access request received from Example Finance Ltd")).toBeVisible();
});

const SAR_CALLS = "Recordings and notes of telephone calls with me";
