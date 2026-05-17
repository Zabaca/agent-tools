import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync, existsSync } from "node:fs";
import * as schema from "./schema.ts";

const DEFAULT_DIR = join(homedir(), ".intent");
const DEFAULT_DB = join(DEFAULT_DIR, "data.db");

if (!existsSync(DEFAULT_DIR)) {
  mkdirSync(DEFAULT_DIR, { recursive: true });
}

const url = process.env.INTENT_DB_URL ?? `file:${DEFAULT_DB}`;
const dbPath = url.replace(/^file:/, "");
const isNew = !existsSync(dbPath);

export const client = createClient({ url });

// Enable WAL mode for concurrent reads while pipeline ingestion holds a read lock.
// Safe to set every time — SQLite ignores if already WAL.
await client.execute("PRAGMA journal_mode=WAL");

// Auto-migrate on first use. Idempotent — uses CREATE IF NOT EXISTS.
if (isNew) {
  await client.execute(`CREATE TABLE IF NOT EXISTS intents (
    id text PRIMARY KEY NOT NULL,
    session_id text NOT NULL,
    stated_at integer NOT NULL,
    intent_text text NOT NULL,
    status text DEFAULT 'active' NOT NULL,
    completed_at integer,
    completion_note text,
    superseded_by text,
    cwd text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_intents_session ON intents (session_id)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_intents_status ON intents (status)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_intents_stated_at ON intents (stated_at)`);
}

export const db = drizzle(client, { schema });
export { schema, dbPath };
