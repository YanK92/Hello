import { expect, test } from "@playwright/test";

test("landing page explains the tool and that it is not advice", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/not legal advice/i)).toBeVisible();
});

test("sign-in page offers password and email link sign-in", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in" }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Email me a link" })).toBeVisible();
});

test("web app manifest is served", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  expect((await res.json()).name).toBe("Evidence Locker");
});

test("no horizontal scrolling on a phone", async ({ page }) => {
  await page.goto("/login");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("security headers are set", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["permissions-policy"]).toContain("geolocation=(self)");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("health check responds without exposing data", async ({ request }) => {
  const res = await request.get("/api/health");
  expect([200, 503]).toContain(res.status());
  expect(Object.keys(await res.json()).sort()).toEqual(["ms", "status", "supabase"]);
});

test("privacy summary lists cookies and rights", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "How your data is handled" })).toBeVisible();
  await expect(page.getByText(/no analytics or advertising cookies/i)).toBeVisible();
});
