import { db, schema } from "./db/index.ts";
import { eq, and, desc, sql } from "drizzle-orm";
import type { Intent, NewIntent } from "./db/schema.ts";

const { intents } = schema;

/**
 * Get the active intent for a session (or null if none).
 * Active = status='active' AND no successor.
 */
export async function activeIntent(sessionId: string): Promise<Intent | null> {
  const rows = await db
    .select()
    .from(intents)
    .where(and(eq(intents.sessionId, sessionId), eq(intents.status, "active")))
    .orderBy(desc(intents.statedAt))
    .limit(1);
  return rows[0] ?? null;
}

/** Set initial (or new) active intent for a session. */
export async function setIntent(args: {
  sessionId: string;
  intentText: string;
  cwd?: string;
}): Promise<Intent> {
  const existing = await activeIntent(args.sessionId);
  if (existing) {
    throw new Error(
      `Session already has active intent: "${existing.intentText}". Use --update to transition or --done to complete first.`,
    );
  }
  const row: NewIntent = {
    sessionId: args.sessionId,
    intentText: args.intentText,
    cwd: args.cwd,
  };
  const [created] = await db.insert(intents).values(row).returning();
  return created;
}

/** Mark current active intent complete. */
export async function doneIntent(args: {
  sessionId: string;
  note?: string;
}): Promise<Intent> {
  const current = await activeIntent(args.sessionId);
  if (!current) throw new Error("No active intent for this session.");
  const [updated] = await db
    .update(intents)
    .set({
      status: "completed",
      completedAt: new Date(),
      completionNote: args.note,
      updatedAt: new Date(),
    })
    .where(eq(intents.id, current.id))
    .returning();
  return updated;
}

/** Mark current active intent as consciously abandoned. */
export async function abandonIntent(args: {
  sessionId: string;
  reason?: string;
}): Promise<Intent> {
  const current = await activeIntent(args.sessionId);
  if (!current) throw new Error("No active intent for this session.");
  const [updated] = await db
    .update(intents)
    .set({
      status: "abandoned",
      completedAt: new Date(),
      completionNote: args.reason,
      updatedAt: new Date(),
    })
    .where(eq(intents.id, current.id))
    .returning();
  return updated;
}

/** Explicit transition: supersede current intent with a new one. */
export async function updateIntent(args: {
  sessionId: string;
  newIntentText: string;
  cwd?: string;
}): Promise<{ prior: Intent | null; next: Intent }> {
  const prior = await activeIntent(args.sessionId);
  const nextRow: NewIntent = {
    sessionId: args.sessionId,
    intentText: args.newIntentText,
    cwd: args.cwd,
  };
  const [next] = await db.insert(intents).values(nextRow).returning();
  let updatedPrior: Intent | null = null;
  if (prior) {
    [updatedPrior] = await db
      .update(intents)
      .set({
        status: "superseded",
        completedAt: new Date(),
        supersededBy: next.id,
        updatedAt: new Date(),
      })
      .where(eq(intents.id, prior.id))
      .returning();
  }
  return { prior: updatedPrior, next };
}

/** All intents for a session, ordered by stated_at. */
export async function sessionIntents(sessionId: string): Promise<Intent[]> {
  return db
    .select()
    .from(intents)
    .where(eq(intents.sessionId, sessionId))
    .orderBy(intents.statedAt);
}

/** History across sessions, filterable by repo (cwd substring) + recency window. */
export async function history(opts: {
  repo?: string;
  days?: number;
  limit?: number;
}): Promise<Intent[]> {
  const limit = opts.limit ?? 25;
  const conditions = [];
  if (opts.repo) conditions.push(sql`${intents.cwd} LIKE ${`%${opts.repo}%`}`);
  if (opts.days) {
    const cutoff = new Date(Date.now() - opts.days * 24 * 60 * 60 * 1000);
    conditions.push(sql`${intents.statedAt} >= ${cutoff}`);
  }
  const where = conditions.length ? and(...conditions) : undefined;
  return db
    .select()
    .from(intents)
    .where(where)
    .orderBy(desc(intents.statedAt))
    .limit(limit);
}

/** Recently active intents (status=active across all sessions). */
export async function stillActive(opts: { limit?: number } = {}): Promise<Intent[]> {
  return db
    .select()
    .from(intents)
    .where(eq(intents.status, "active"))
    .orderBy(desc(intents.statedAt))
    .limit(opts.limit ?? 10);
}
