import { join } from "node:path";
import { homedir } from "node:os";
import { defineConfig } from "drizzle-kit";

// drizzle-kit always targets the global default DB path.
// Runtime config resolution (project-level DBs, remote Turso URLs) is handled
// by src/config.ts — drizzle-kit is only used for schema generation/migrations.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: join(homedir(), ".pm-agent", "data.db") },
});
