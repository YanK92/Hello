import { unzipSync, strFromU8 } from "fflate";
import { expect, test } from "@playwright/test";

// Phase 6: data subject rights. Download everything, then delete the account.
test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase stack running");

test("download all my data, then delete my account", async ({ page }) => {
  const email = `acct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  await page.goto("/login?next=/cases/new");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel(/case title/i).fill("Sofa");
  await page.getByRole("button", { name: "Save case" }).click();
  await expect(page.getByRole("heading", { name: "Sofa" })).toBeVisible();

  await page.getByRole("link", { name: "Account" }).click();
  const res = await page.request.get("/account/export");
  expect(res.headers()["content-type"]).toBe("application/zip");
  const data = JSON.parse(strFromU8(unzipSync(new Uint8Array(await res.body()))["data.json"]));
  expect(data.cases.map((c: { title: string }) => c.title)).toEqual(["Sofa"]);
  expect(data.audit_log.length).toBeGreaterThan(0);

  await page.locator("summary", { hasText: "Delete my account" }).click();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/\/\?account=deleted/);

  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign in" }).last().click();
  await expect(page.getByText("Email or password not recognised.")).toBeVisible();
});
