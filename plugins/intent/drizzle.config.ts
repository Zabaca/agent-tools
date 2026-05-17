import { join } from "node:path";
import { homedir } from "node:os";
import { defineConfig } from "drizzle-kit";

// drizzle-kit always targets the global default DB path.
// Runtime config (per-project, custom paths) is handled by src/config.ts.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: join(homedir(), ".intent", "data.db") },
});
