import * as ops from "./ops.ts";

const args = Bun.argv.slice(2);
const cmd = args[0];

function flag(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

function rest(after: number): string {
  return args.slice(after).filter((a) => !a.startsWith("--")).join(" ").trim();
}

function out(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

function fail(msg: string): never {
  console.error(JSON.stringify({ error: msg }));
  process.exit(1);
}

function getSessionId(): string {
  // CLAUDE_SESSION_ID is set by Claude Code hooks. For manual CLI invocation,
  // accept --session.
  const id = process.env.CLAUDE_SESSION_ID ?? flag("session");
  if (!id) fail("session id required: set CLAUDE_SESSION_ID env or pass --session <id>");
  return id;
}

function getCwd(): string {
  return process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
}

try {
  if (!cmd || hasFlag("help") || cmd === "help") {
    console.log(`intent — capture session intent, detect drift, log transitions

Commands:
  intent set <text>          Set initial intent for the current session
  intent done [--note "..."] Mark current intent as completed
  intent abandon [--reason]  Mark current intent as consciously dropped
  intent update <text>       Transition to a new intent (closes current)
  intent status              Show current + history for this session
  intent history [--repo X] [--days N] [--limit N]
                             Cross-session intent history
  intent active              Show all currently-active intents (across sessions)

Environment:
  CLAUDE_SESSION_ID   the session to attach intents to
  CLAUDE_PROJECT_DIR  launch cwd of the session (logged on each intent)
  INTENT_DB_URL       override SQLite path (default ~/.intent/data.db)
`);
    process.exit(0);
  }

  if (cmd === "set") {
    const text = rest(1);
    if (!text) fail("intent text required: intent set <text>");
    const result = await ops.setIntent({
      sessionId: getSessionId(),
      intentText: text,
      cwd: getCwd(),
    });
    out({ ok: true, intent: result });
  } else if (cmd === "done") {
    const result = await ops.doneIntent({
      sessionId: getSessionId(),
      note: flag("note"),
    });
    out({ ok: true, intent: result });
  } else if (cmd === "abandon") {
    const result = await ops.abandonIntent({
      sessionId: getSessionId(),
      reason: flag("reason"),
    });
    out({ ok: true, intent: result });
  } else if (cmd === "update") {
    const text = rest(1);
    if (!text) fail("new intent text required: intent update <text>");
    const result = await ops.updateIntent({
      sessionId: getSessionId(),
      newIntentText: text,
      cwd: getCwd(),
    });
    out({ ok: true, ...result });
  } else if (cmd === "status") {
    const sessionId = getSessionId();
    const current = await ops.activeIntent(sessionId);
    const all = await ops.sessionIntents(sessionId);
    out({ current, all });
  } else if (cmd === "current") {
    // Tight output for hook consumption.
    const current = await ops.activeIntent(getSessionId());
    if (current) console.log(current.intentText);
    // empty stdout if none — hooks can check for emptiness
  } else if (cmd === "history") {
    const repo = flag("repo");
    const days = flag("days") ? Number(flag("days")) : undefined;
    const limit = flag("limit") ? Number(flag("limit")) : undefined;
    const rows = await ops.history({ repo, days, limit });
    out(rows);
  } else if (cmd === "active") {
    out(await ops.stillActive({ limit: Number(flag("limit") ?? 25) }));
  } else {
    fail(`unknown command: ${cmd}. Try: intent help`);
  }
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}
