#!/usr/bin/env node
// Fails if user-facing source contains banned phrases (advice, outcome
// predictions, labels about firms). See CLAUDE.md "Product guardrails".
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = ["src", "public"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".md", ".mdx", ".json", ".html", ".txt"]);
const SKIP = /\.test\.[jt]sx?$/;

export function loadPhrases() {
  return JSON.parse(readFileSync(path.join(ROOT, "scripts/banned-phrases.json"), "utf8")).phrases;
}

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Returns [{ line, phrase }] for every banned phrase found in text. */
export function findBannedPhrases(text, phrases) {
  const hits = [];
  // Treat straight and curly apostrophes alike; match whole words only.
  const normalised = text.replace(/[‘’]/g, "'");
  const lines = normalised.split("\n");
  for (const phrase of phrases) {
    const re = new RegExp(`(^|[^\\p{L}])${escape(phrase)}`, "iu");
    lines.forEach((line, i) => {
      if (re.test(line)) hits.push({ line: i + 1, phrase });
    });
  }
  return hits.sort((a, b) => a.line - b.line);
}

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (EXTENSIONS.has(path.extname(name)) && !SKIP.test(name)) yield full;
  }
}

function main() {
  const phrases = loadPhrases();
  let failures = 0;
  for (const dir of SCAN_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      for (const hit of findBannedPhrases(readFileSync(file, "utf8"), phrases)) {
        failures++;
        console.error(`${path.relative(ROOT, file)}:${hit.line}  banned phrase "${hit.phrase}"`);
      }
    }
  }
  if (failures) {
    console.error(`\ncopy-lint: ${failures} banned phrase(s). Rewrite as neutral information.`);
    process.exit(1);
  }
  console.log("copy-lint: no banned phrases found.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
