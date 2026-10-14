import { expect, test } from "@playwright/test";

// Phase 2: add dated entries, edit one (history kept), count days between two.
test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase stack running");

test("build a chronology, edit an entry and count days between entries", async ({ page }) => {
  const email = `timeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  await page.goto("/login?next=/cases/new");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel(/case title/i).fill("Sofa");
  await page.getByRole("button", { name: "Save case" }).click();
  await page.getByRole("link", { name: "Timeline" }).click();

  async function add(type: string, title: string, when: string) {
    await page.getByRole("button", { name: "Add an entry" }).click();
    await page.getByLabel("Type", { exact: true }).selectOption({ label: type });
    await page.getByLabel("What happened", { exact: true }).fill(title);
    await page.getByLabel("When", { exact: true }).fill(when);
    await page.getByRole("button", { name: "Add entry" }).click();
    await expect(page.getByText(title)).toBeVisible();
  }

  await add("Payment", "Paid for the sofa", "2026-09-01T10:00");
  await add("Call, email or letter", "Phoned the shop", "2026-09-15T16:30");

  // Edit, then see the earlier version in History.
  const card = page.locator("li.entry", { hasText: "Phoned the shop" });
  await card.getByRole("button", { name: "Edit" }).click();
  await card.getByLabel("Who was involved").fill("Store manager");
  await card.getByRole("button", { name: "Save changes" }).click();
  await expect(card.getByText("Who: Store manager")).toBeVisible();
  await card.getByRole("button", { name: "History" }).click();
  await expect(card.getByText(/Version before the change/)).toBeVisible();

  // Count days between the two entries.
  await page.getByRole("checkbox", { name: /Paid for the sofa/ }).check();
  await page.getByRole("checkbox", { name: /Phoned the shop/ }).check();
  await expect(page.getByText("14 days between these entries")).toBeVisible();

  // Filter by type.
  await page.getByRole("button", { name: "Payment", exact: true }).click();
  await expect(page.getByText("Phoned the shop")).toHaveCount(0);
  await expect(page.getByText("Paid for the sofa")).toBeVisible();
});
