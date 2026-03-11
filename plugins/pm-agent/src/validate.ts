#!/usr/bin/env bun
import { resolve } from "node:path";
import { validatePlugin } from "./validation/index.ts";

const dir = resolve(process.argv[2] ?? ".");

const result = await validatePlugin(dir);

if (result.valid) {
  console.log(
    `\x1b[32m✓\x1b[0m Plugin valid — ${result.filesChecked.length} file(s) checked`
  );
  process.exit(0);
} else {
  console.error(
    `\x1b[31m✗\x1b[0m ${result.errors.length} validation error(s):\n`
  );
  for (const err of result.errors) {
    const field = err.field ? ` → ${err.field}` : "";
    console.error(`  \x1b[31m•\x1b[0m ${err.file}${field}`);
    console.error(`    ${err.message}\n`);
  }
  process.exit(1);
}
