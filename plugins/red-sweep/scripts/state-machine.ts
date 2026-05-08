#!/usr/bin/env bun
/**
 * red-sweep state machine — enforced via Claude Code hooks.
 *
 * Single entry point invoked by the SKILL's PreToolUse / PostToolUse / Stop hooks.
 * Reads tool-call JSON from stdin, looks up the project's state in
 * .red-sweep/state.json, and either allows the action (exit 0) or denies it
 * (deny JSON to stdout + exit 2).
 */

import { resolve, basename, isAbsolute, join } from "node:path";
import { existsSync } from "node:fs";

type Event = "pre-write" | "post-write" | "pre-bash" | "stop";
type StateName = "INIT" | "DISCOVERING" | "FILING";
type Tracker = "github" | "markdown";

interface RedSweepState {
  state: StateName;
  // config (set during INIT)
  test_cmd_full?: string;
  test_cmd_single?: string; // contains {file} placeholder
  test_pattern?: string;    // glob, e.g. "*.test.ts"
  test_dir?: string;
  test_marker_regex?: string;
  tracker?: Tracker;
  findings_file?: string;
  focus?: string;
  scope?: string;
  loop_limit?: number;
  // runtime
  finding_count: number;
  stop_attempts: number;
  current_test: string;
  baseline_test_count: number;
  pending_test_file: string;
}

interface HookInput {
  tool_name?: string;
  tool_input?: {
    file_path?: string;
    command?: string;
    [k: string]: unknown;
  };
  cwd?: string;
  [k: string]: unknown;
}

// ---------------------------------------------------------------------------
// IO helpers
// ---------------------------------------------------------------------------

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  const decoder = new TextDecoder();
  for await (const chunk of Bun.stdin.stream()) chunks.push(chunk);
  return chunks.map((c) => decoder.decode(c)).join("");
}

function deny(reason: string): never {
  const out = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(JSON.stringify(out));
  process.exit(2);
}

function blockStop(reason: string): never {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(2);
}

function allow(): never {
  process.exit(0);
}

// ---------------------------------------------------------------------------
// State persistence
// ---------------------------------------------------------------------------

async function readState(stateFile: string): Promise<RedSweepState | null> {
  if (!existsSync(stateFile)) return null;
  try {
    const text = await Bun.file(stateFile).text();
    return JSON.parse(text) as RedSweepState;
  } catch {
    return null;
  }
}

async function writeState(stateFile: string, state: RedSweepState): Promise<void> {
  await Bun.write(stateFile, JSON.stringify(state, null, 2));
}

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

function globToRegex(glob: string): RegExp {
  let re = "^";
  for (const ch of glob) {
    if (ch === "*") re += "[^/]*";
    else if (ch === "?") re += ".";
    else if (".+^$()[]{}|\\".includes(ch)) re += "\\" + ch;
    else re += ch;
  }
  return new RegExp(re + "$");
}

function isTestFile(path: string, state: RedSweepState): boolean {
  if (!state.test_pattern) return false;
  const base = basename(path);
  if (!globToRegex(state.test_pattern).test(base)) return false;
  if (state.test_dir && state.test_dir.length > 0) {
    const dir = state.test_dir.replace(/\/+$/, "");
    return path.includes(`/${dir}/`) || path.startsWith(`${dir}/`);
  }
  return true;
}

async function countTests(file: string, state: RedSweepState): Promise<number> {
  if (!existsSync(file)) return 0;
  const markerSrc = state.test_marker_regex ?? "^\\s*(it|test)\\s*\\(";
  const re = new RegExp(markerSrc, "gm");
  const text = await Bun.file(file).text();
  return (text.match(re) ?? []).length;
}

async function runSingleFileTests(file: string, state: RedSweepState, cwd: string): Promise<number> {
  // Returns the test command's exit code. If unconfigured, returns 0 (don't block).
  if (!state.test_cmd_single) return 0;
  const cmd = state.test_cmd_single.replaceAll("{file}", file);
  const proc = Bun.spawn(["bash", "-c", cmd], {
    cwd,
    stdout: "ignore",
    stderr: "ignore",
  });
  return await proc.exited;
}

const BLOCKED_BASH = [
  /\bgit\s+commit\b/,
  /\bgit\s+push\b/,
  /\bgit\s+reset\b/,
  /\bgit\s+checkout\b/,
  /\bgit\s+rebase\b/,
  /\bgit\s+merge\b/,
  /\brm\s+-/,
  /(^|\s|;|&|\|)rm\s+/,
];

function isBlockedBash(cmd: string): boolean {
  return BLOCKED_BASH.some((re) => re.test(cmd));
}

function isFilingBash(cmd: string): boolean {
  return /\bgh\s+issue\s+create\b/.test(cmd);
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleStop(state: RedSweepState, stateFile: string): Promise<never> {
  const limit = state.loop_limit ?? 10;
  if (state.finding_count > 0) allow();
  if (state.stop_attempts >= limit) allow();

  state.stop_attempts += 1;
  await writeState(stateFile, state);
  blockStop(
    `No findings filed yet. Keep scanning the focus area for issues. (attempt ${state.stop_attempts} of ${limit})`,
  );
}

async function handlePreWrite(
  input: HookInput,
  state: RedSweepState,
  stateFile: string,
): Promise<never> {
  const filePath = input.tool_input?.file_path;
  if (!filePath) allow();

  if (state.state === "DISCOVERING") {
    if (!isTestFile(filePath, state)) {
      deny(
        `red-sweep DISCOVERING: only test files may be edited. '${filePath}' is not a test file (pattern=${state.test_pattern}, dir=${state.test_dir}). Source fixes happen in Phase 2.`,
      );
    }
    if (state.current_test && state.current_test !== filePath) {
      deny(
        `red-sweep: a red test already exists at '${state.current_test}' that hasn't been filed. File the finding (gh issue create or append to the findings doc) before writing another test.`,
      );
    }
    state.baseline_test_count = await countTests(filePath, state);
    state.pending_test_file = filePath;
    await writeState(stateFile, state);
    allow();
  }

  if (state.state === "FILING") {
    if (state.tracker === "markdown" && state.findings_file) {
      const findings = state.findings_file;
      const cwd = input.cwd ?? process.cwd();
      const absFindings = isAbsolute(findings) ? findings : join(cwd, findings);
      if (filePath === findings || filePath === absFindings) allow();
    }
    deny(
      `red-sweep FILING: only the findings file (${state.findings_file ?? "<unset>"}) may be edited right now. File the current red test, then return to discovery.`,
    );
  }

  allow();
}

async function handlePostWrite(
  input: HookInput,
  state: RedSweepState,
  stateFile: string,
  cwd: string,
): Promise<never> {
  const filePath = input.tool_input?.file_path;
  if (!filePath) allow();
  if (state.state !== "DISCOVERING") allow();
  if (!isTestFile(filePath, state)) allow();

  const newCount = await countTests(filePath, state);
  const delta = newCount - (state.baseline_test_count ?? 0);

  if (delta === 0) {
    deny(
      `red-sweep: write to '${filePath}' did not add a new test (baseline=${state.baseline_test_count}, after=${newCount}). The red test is the exploration tool — add exactly one failing test.`,
    );
  }
  if (delta > 1) {
    deny(
      `red-sweep: write to '${filePath}' added ${delta} tests. Only ONE failing test at a time. Remove the extras.`,
    );
  }

  const exitCode = await runSingleFileTests(filePath, state, cwd);
  if (exitCode === 0) {
    deny(
      `red-sweep: tests in '${filePath}' pass. A red sweep test must FAIL — it has to prove an issue exists. Rewrite or remove it.`,
    );
  }

  state.current_test = filePath;
  state.state = "FILING";
  await writeState(stateFile, state);
  allow();
}

async function handlePreBash(
  input: HookInput,
  state: RedSweepState,
  stateFile: string,
): Promise<never> {
  const cmd = input.tool_input?.command ?? "";

  if (state.state === "DISCOVERING") {
    if (isBlockedBash(cmd)) {
      deny(
        `red-sweep DISCOVERING: '${cmd}' is blocked. No commits, resets, or destructive ops during discovery.`,
      );
    }
    allow();
  }

  if (state.state === "FILING") {
    if (isFilingBash(cmd)) {
      state.finding_count += 1;
      state.state = "DISCOVERING";
      state.current_test = "";
      await writeState(stateFile, state);
      allow();
    }
    if (isBlockedBash(cmd)) {
      deny(
        `red-sweep FILING: '${cmd}' is blocked. File the current finding via 'gh issue create' or by editing the findings doc.`,
      );
    }
    allow();
  }

  allow();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const event = process.argv[2] as Event | undefined;
  if (!event) {
    process.stderr.write("state-machine.ts: missing event arg\n");
    process.exit(1);
  }

  const stdin = await readStdin();
  const input: HookInput = stdin.trim() ? JSON.parse(stdin) : {};
  const cwd = input.cwd ?? process.cwd();
  const stateFile = resolve(cwd, ".red-sweep/state.json");

  const state = await readState(stateFile);
  // INIT (no state file) → permissive: agent is still configuring.
  if (!state) allow();
  if (state.state === "INIT") allow();

  switch (event) {
    case "stop":
      return handleStop(state, stateFile);
    case "pre-write":
      return handlePreWrite(input, state, stateFile);
    case "post-write":
      return handlePostWrite(input, state, stateFile, cwd);
    case "pre-bash":
      return handlePreBash(input, state, stateFile);
    default:
      process.stderr.write(`state-machine.ts: unknown event '${event}'\n`);
      process.exit(0);
  }
}

main().catch((err) => {
  process.stderr.write(`state-machine.ts error: ${err?.message ?? err}\n`);
  // Fail open — never wedge the user.
  process.exit(0);
});
