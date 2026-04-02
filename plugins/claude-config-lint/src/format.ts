import type { ValidationResult } from "./types.ts";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

export function formatResult(result: ValidationResult, mode: string): void {
  const label = mode === "plugin" ? "Plugin" : "Project";

  if (result.valid) {
    console.log(
      `${GREEN}✓${RESET} ${label} valid — ${result.filesChecked.length} file(s) checked`
    );
    if (result.filesChecked.length === 0) {
      console.log(`${DIM}  (no config files found to validate)${RESET}`);
    }
  } else {
    console.error(
      `${RED}✗${RESET} ${result.errors.length} validation error(s):\n`
    );
    for (const err of result.errors) {
      const field = err.field ? ` → ${err.field}` : "";
      console.error(`  ${RED}•${RESET} ${err.file}${field}`);
      console.error(`    ${err.message}\n`);
    }
  }
}
