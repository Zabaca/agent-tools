import { existsSync, mkdirSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.ts";
import { config } from "../config.ts";

mkdirSync(config.configDir, { recursive: true });

export const dbPath = config.url.replace(/^file:/, "");

// Auto-migrate on first use
const isNew = !existsSync(dbPath);
const client = createClient({
  url: config.url,
  ...(config.syncUrl ? { syncUrl: config.syncUrl } : {}),
  ...(config.authToken ? { authToken: config.authToken } : {}),
});

if (isNew) {
  await client.execute(`CREATE TABLE IF NOT EXISTS entities (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    description text,
    parent_id text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES entities(id)
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS problems (
    id text PRIMARY KEY NOT NULL,
    title text NOT NULL,
    description text,
    impact text,
    opportunity text,
    state text DEFAULT 'identified' NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS entity_problems (
    id text PRIMARY KEY NOT NULL,
    entity_id text NOT NULL,
    problem_id text NOT NULL,
    created_at integer NOT NULL,
    FOREIGN KEY (entity_id) REFERENCES entities(id),
    FOREIGN KEY (problem_id) REFERENCES problems(id)
  )`);
  await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS entity_problems_entity_id_problem_id_unique ON entity_problems (entity_id, problem_id)`);
  await client.execute(`CREATE TABLE IF NOT EXISTS solutions (
    id text PRIMARY KEY NOT NULL,
    title text NOT NULL,
    description text,
    problem_id text NOT NULL,
    state text DEFAULT 'proposed' NOT NULL,
    reason text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    FOREIGN KEY (problem_id) REFERENCES problems(id)
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS state_transitions (
    id text PRIMARY KEY NOT NULL,
    solution_id text NOT NULL,
    from_state text,
    to_state text NOT NULL,
    reason text,
    created_at integer NOT NULL,
    FOREIGN KEY (solution_id) REFERENCES solutions(id)
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS tasks (
    id text PRIMARY KEY NOT NULL,
    title text NOT NULL,
    description text,
    solution_id text,
    parent_id text,
    entity_id text,
    state text DEFAULT 'pending' NOT NULL,
    position integer DEFAULT 0 NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    FOREIGN KEY (solution_id) REFERENCES solutions(id),
    FOREIGN KEY (parent_id) REFERENCES tasks(id),
    FOREIGN KEY (entity_id) REFERENCES entities(id)
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS pipeline (
    id text PRIMARY KEY NOT NULL,
    solution_id text NOT NULL UNIQUE,
    state text DEFAULT 'in_progress' NOT NULL,
    outcome text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    FOREIGN KEY (solution_id) REFERENCES solutions(id)
  )`);
}

// Migrate existing DBs
try { await client.execute(`ALTER TABLE entities ADD COLUMN description text`); } catch (_) {}
try {
  await client.execute(`CREATE TABLE IF NOT EXISTS solutions (
    id text PRIMARY KEY NOT NULL, title text NOT NULL, description text,
    problem_id text NOT NULL, state text DEFAULT 'proposed' NOT NULL,
    created_at integer NOT NULL, updated_at integer NOT NULL,
    FOREIGN KEY (problem_id) REFERENCES problems(id)
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS tasks (
    id text PRIMARY KEY NOT NULL, title text NOT NULL, description text,
    solution_id text, parent_id text, entity_id text,
    state text DEFAULT 'pending' NOT NULL, position integer DEFAULT 0 NOT NULL,
    created_at integer NOT NULL, updated_at integer NOT NULL,
    FOREIGN KEY (solution_id) REFERENCES solutions(id),
    FOREIGN KEY (parent_id) REFERENCES tasks(id),
    FOREIGN KEY (entity_id) REFERENCES entities(id)
  )`);
} catch (_) {}

// Migrate: add reason column to solutions + state_transitions table
try { await client.execute(`ALTER TABLE solutions ADD COLUMN reason text`); } catch (_) {}
try {
  await client.execute(`CREATE TABLE IF NOT EXISTS state_transitions (
    id text PRIMARY KEY NOT NULL, solution_id text NOT NULL, from_state text,
    to_state text NOT NULL, reason text, created_at integer NOT NULL,
    FOREIGN KEY (solution_id) REFERENCES solutions(id)
  )`);
} catch (_) {}

// Migrate: add pipeline table
try {
  await client.execute(`CREATE TABLE IF NOT EXISTS pipeline (
    id text PRIMARY KEY NOT NULL, solution_id text NOT NULL UNIQUE,
    state text DEFAULT 'in_progress' NOT NULL, outcome text,
    created_at integer NOT NULL, updated_at integer NOT NULL,
    FOREIGN KEY (solution_id) REFERENCES solutions(id)
  )`);
} catch (_) {}

// Enable foreign key enforcement (SQLite has it off by default)
await client.execute("PRAGMA foreign_keys = ON");

export const db = drizzle(client, { schema });
