import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

// Intents: one row per stated intent within a session.
// A session can have 1..N intents. Transitions are captured by supersededBy
// (which points to the next intent_id that replaced this one).
export const intents = sqliteTable(
  "intents",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    sessionId: text("session_id").notNull(),
    statedAt: integer("stated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    intentText: text("intent_text").notNull(),
    status: text("status").notNull().default("active"), // active | completed | abandoned | superseded
    completedAt: integer("completed_at", { mode: "timestamp" }),
    completionNote: text("completion_note"),
    supersededBy: text("superseded_by"), // FK to intents.id (intent that replaced this)
    cwd: text("cwd"), // launch cwd of the session this intent was set in
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => ({
    sessionIdx: index("idx_intents_session").on(table.sessionId),
    statusIdx: index("idx_intents_status").on(table.status),
    statedAtIdx: index("idx_intents_stated_at").on(table.statedAt),
  }),
);

export type Intent = typeof intents.$inferSelect;
export type NewIntent = typeof intents.$inferInsert;
