#!/usr/bin/env node
// Screenshots every dev preview screen on a phone viewport, light and dark.
// Usage: start `npm run dev`, then `npm run preview:shots [-- outDir]`.
// Set PLAYWRIGHT_CHROMIUM_PATH to use a preinstalled Chromium.
import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

const BASE = process.env.PREVIEW_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "preview-shots";
const SCREENS = [
  "wizard-1-item",
  "wizard-2-what",
  "wizard-3-where",
  "wizard-3-where-recorded",
  "wizard-3-where-manual",
  "wizard-4-photos",
  "case",
];
// Hide the Next.js dev tools button so it does not cover content.
const HIDE_DEV_TOOLS = "nextjs-portal{display:none!important}";

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
);
for (const colorScheme of ["light", "dark"]) {
  const page = await (await browser.newContext({ ...devices["Pixel 7"], colorScheme })).newPage();
  for (const screen of SCREENS) {
    await page.goto(`${BASE}/dev/preview/${screen}`, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: HIDE_DEV_TOOLS });
    await page.screenshot({ path: `${OUT}/${screen}-${colorScheme}.png`, fullPage: true });
  }
}
await browser.close();
console.log(`Saved ${SCREENS.length * 2} screenshots to ${OUT}/`);
