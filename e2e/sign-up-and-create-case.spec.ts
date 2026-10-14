import { expect, test } from "@playwright/test";

// Needs a running Supabase stack (`npx supabase start`) with email
// confirmations off, which is the local default. CI sets E2E_SUPABASE=1.
test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase stack running");

test("a new user can sign up, create a case and see it in their list", async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;

  await page.goto("/cases");
  await expect(page).toHaveURL(/\/login\?next=%2Fcases/);

  await page.locator("#email").fill(email);
  await page.locator("#password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "My cases" })).toBeVisible();
  await expect(page.getByText(/no cases yet/i)).toBeVisible();

  await page.getByRole("link", { name: "Start a new case" }).click();
  await page.getByLabel(/case title/i).fill("Car gearbox fault");
  await page.getByLabel(/what is the item/i).fill("2019 hatchback, AB19 CDE");
  await page.getByRole("button", { name: "Save case" }).click();

  await expect(page.getByRole("heading", { name: "Car gearbox fault" })).toBeVisible();
  await expect(page.getByText("2019 hatchback, AB19 CDE")).toBeVisible();

  await page.getByRole("link", { name: /my cases/i }).first().click();
  await expect(page.getByRole("link", { name: /car gearbox fault/i })).toBeVisible();
});

test("one user cannot open another user's case", async ({ browser }) => {
  async function signUp(email: string) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("correct-horse-battery");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "My cases" })).toBeVisible();
    return page;
  }
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const owner = await signUp(`owner-${stamp}@example.test`);
  await owner.goto("/cases/new");
  await owner.getByLabel(/case title/i).fill("Private case");
  await owner.getByRole("button", { name: "Save case" }).click();
  await expect(owner.getByRole("heading", { name: "Private case" })).toBeVisible();
  const caseUrl = owner.url();

  const other = await signUp(`other-${stamp}@example.test`);
  await other.goto(caseUrl);
  await expect(other.getByRole("heading", { name: "Not found" })).toBeVisible();
  await expect(other.getByText("Private case")).toHaveCount(0);
});
