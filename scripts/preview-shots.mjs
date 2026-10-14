#!/usr/bin/env node
// Screenshots every dev preview screen on a phone viewport, light and dark.
// Usage: start `npm run dev`, then `npm run preview:shots [-- outDir]`.
// PREVIEW_ONLY=timeline limits it to screens whose name starts with that.
// Set PLAYWRIGHT_CHROMIUM_PATH to use a preinstalled Chromium.
import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

const BASE = process.env.PREVIEW_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "preview-shots";
// Screens are listed on the preview index page, so this never goes stale.
const index = await (await fetch(`${BASE}/dev/preview`)).text();
const SCREENS = [...index.matchAll(/href="\/dev\/preview\/([a-z0-9-]+)"/g)].map((m) => m[1])
  .filter((s) => !process.env.PREVIEW_ONLY || s.startsWith(process.env.PREVIEW_ONLY));
if (!SCREENS.length) throw new Error(`No preview screens found at ${BASE}/dev/preview`);
// Hide the Next.js dev tools button so it does not cover content.
const HIDE_DEV_TOOLS = "nextjs-portal{display:none!important}";

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  // UK date formats in <input type="date">, as UK users see them.
  args: ["--lang=en-GB"],
  ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
});
for (const colorScheme of ["light", "dark"]) {
  const page = await (await browser.newContext({ ...devices["Pixel 7"], colorScheme, locale: "en-GB", timezoneId: "Europe/London" })).newPage();
  for (const screen of SCREENS) {
    await page.goto(`${BASE}/dev/preview/${screen}`, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: HIDE_DEV_TOOLS });
    await page.screenshot({ path: `${OUT}/${screen}-${colorScheme}.png`, fullPage: true });
  }
}
await browser.close();
console.log(`Saved ${SCREENS.length * 2} screenshots to ${OUT}/`);
