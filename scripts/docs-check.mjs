#!/usr/bin/env node
// Check the maintained root guides and notices, independent of the retired docs site.
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const guides = ["README.md", "API.md", "THIRD_PARTY_NOTICES.md"];
const errors = [];

for (const file of [...guides, "LICENSE"]) {
  if (!existsSync(resolve(root, file))) errors.push(`missing required doc: ${file}`);
}
for (const file of guides) {
  if (!existsSync(resolve(root, file))) continue;
  const content = await readFile(resolve(root, file), "utf8");
  if (!/^# .+/m.test(content)) errors.push(`${file}: missing document title`);
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].split("#")[0].trim();
    if (!target || /^(https?:|mailto:)/.test(target)) continue;
    if (!existsSync(resolve(root, target.replace(/^\//, "")))) {
      errors.push(`${file}: broken link -> ${target}`);
    }
  }
}
if (errors.length) {
  console.error(`docs:check failed:\n${errors.map(error => `  - ${error}`).join("\n")}`);
  process.exit(1);
}
console.log("docs:check passed (README, API reference, and notices)");
