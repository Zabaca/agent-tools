#!/usr/bin/env bun
/**
 * red-sweep state machine — enforced via Claude Code hooks.
 *
 * Single entry point invoked by the SKILL's PreToolUse / PostToolUse / Stop hooks.
 * Reads tool-call JSON from stdin, looks up the project's state in
 * .red-sweep/state.json, and either allows the action (exit 0) or denies it
 * (deny JSON to stdout + exit 2).
 *
 * The decision logic lives in `handleHookEvent` and is pure (effects injected),
 * so it's directly testable without touching stdin or the filesystem.
 */

import { resolve, basename, isAbsolute, join } from "node:path";
import { existsSync } from "node:fs";

export type Event = "pre-write" | "post-write" | "pre-bash" | "stop";
export type StateName = "INIT" | "DISCOVERING" | "FILING";
export type Tracker = "github" | "markdown";

export interface RedSweepState {
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

export interface HookInput {
  tool_name?: string;
  tool_input?: {
    file_path?: string;
    command?: string;
    [k: string]: unknown;
  };
  cwd?: string;
  [k: string]: unknown;
}

export type Decision =
  | { kind: "allow"; newState?: RedSweepState }
  | { kind: "deny"; reason: string; newState?: RedSweepState }
  | { kind: "block-stop"; reason: string; newState?: RedSweepState };

export interface Effects {
  /** Returns the number of test markers currently in `file`, or 0 if missing. */
  countTests: (file: string) => Promise<number>;
  /** Returns the exit code of running the configured single-file test command. */
  runSingleFileTests: (file: string) => Promise<number>;
}

// ---------------------------------------------------------------------------
// Domain helpers (pure)
// ---------------------------------------------------------------------------

export function globToRegex(glob: string): RegExp {
  let re = "^";
  for (const ch of glob) {
    if (ch === "*") re += "[^/]*";
    else if (ch === "?") re += ".";
    else if (".+^$()[]{}|\\".includes(ch)) re += "\\" + ch;
    else re += ch;
  }
  return new RegExp(re + "$");
}

export function isTestFile(path: string, state: RedSweepState): boolean {
  if (!state.test_pattern) return false;
  const base = basename(path);
  if (!globToRegex(state.test_pattern).test(base)) return false;
  if (state.test_dir && state.test_dir.length > 0) {
    const dir = state.test_dir.replace(/\/+$/, "");
    return path.includes(`/${dir}/`) || path.startsWith(`${dir}/`);
  }
  return true;
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

export function isBlockedBash(cmd: string): boolean {
  return BLOCKED_BASH.some((re) => re.test(cmd));
}

export function isFilingBash(cmd: string): boolean {
  return /\bgh\s+issue\s+create\b/.test(cmd);
}

// ---------------------------------------------------------------------------
// Pure decision function
// ---------------------------------------------------------------------------

export async function handleHookEvent(
  event: Event,
  input: HookInput,
  state: RedSweepState,
  effects: Effects,
): Promise<Decision> {
  // INIT — no enforcement.
  if (state.state === "INIT") return { kind: "allow" };

  if (event === "stop") {
    const limit = state.loop_limit ?? 10;
    if (state.finding_count > 0) return { kind: "allow" };
    if (state.stop_attempts >= limit) return { kind: "allow" };
    const newState: RedSweepState = { ...state, stop_attempts: state.stop_attempts + 1 };
    return {
      kind: "block-stop",
      reason: `No findings filed yet. Keep scanning the focus area for issues. (attempt ${newState.stop_attempts} of ${limit})`,
      newState,
    };
  }

  if (event === "pre-write") {
    const filePath = input.tool_input?.file_path;
    if (!filePath) return { kind: "allow" };

    if (state.state === "DISCOVERING") {
      if (!isTestFile(filePath, state)) {
        return {
          kind: "deny",
          reason: `red-sweep DISCOVERING: only test files may be edited. '${filePath}' is not a test file (pattern=${state.test_pattern}, dir=${state.test_dir}). Source fixes happen in Phase 2.`,
        };
      }
      if (state.current_test && state.current_test !== filePath) {
        return {
          kind: "deny",
          reason: `red-sweep: a red test already exists at '${state.current_test}' that hasn't been filed. File the finding (gh issue create or append to the findings doc) before writing another test.`,
        };
      }
      const baseline = await effects.countTests(filePath);
      return {
        kind: "allow",
        newState: { ...state, baseline_test_count: baseline, pending_test_file: filePath },
      };
    }

    if (state.state === "FILING") {
      if (state.tracker === "markdown" && state.findings_file) {
        const findings = state.findings_file;
        const cwd = input.cwd ?? process.cwd();
        const absFindings = isAbsolute(findings) ? findings : join(cwd, findings);
        if (filePath === findings || filePath === absFindings) return { kind: "allow" };
      }
      return {
        kind: "deny",
        reason: `red-sweep FILING: only the findings file (${state.findings_file ?? "<unset>"}) may be edited right now. File the current red test, then return to discovery.`,
      };
    }

    return { kind: "allow" };
  }

  if (event === "post-write") {
    const filePath = input.tool_input?.file_path;
    if (!filePath) return { kind: "allow" };
    if (state.state !== "DISCOVERING") return { kind: "allow" };
    if (!isTestFile(filePath, state)) return { kind: "allow" };

    const newCount = await effects.countTests(filePath);
    const delta = newCount - (state.baseline_test_count ?? 0);

    if (delta === 0) {
      return { kind: "allow" }; // edits to helpers / setup are fine
    }
    if (delta > 1) {
      return {
        kind: "deny",
        reason: `red-sweep: write to '${filePath}' added ${delta} tests. Only ONE failing test at a time. Remove the extras.`,
      };
    }

    const exitCode = await effects.runSingleFileTests(filePath);
    if (exitCode === 0) {
      return {
        kind: "deny",
        reason: `red-sweep: tests in '${filePath}' pass. A red sweep test must FAIL — it has to prove an issue exists. Rewrite or remove it.`,
      };
    }

    return {
      kind: "allow",
      newState: { ...state, current_test: filePath, state: "FILING" },
    };
  }

  if (event === "pre-bash") {
    const cmd = input.tool_input?.command ?? "";

    if (state.state === "DISCOVERING") {
      if (isBlockedBash(cmd)) {
        return {
          kind: "deny",
          reason: `red-sweep DISCOVERING: '${cmd}' is blocked. No commits, resets, or destructive ops during discovery.`,
        };
      }
      return { kind: "allow" };
    }

    if (state.state === "FILING") {
      if (isFilingBash(cmd)) {
        return {
          kind: "allow",
          newState: {
            ...state,
            finding_count: state.finding_count + 1,
            state: "DISCOVERING",
            current_test: "",
          },
        };
      }
      if (isBlockedBash(cmd)) {
        return {
          kind: "deny",
          reason: `red-sweep FILING: '${cmd}' is blocked. File the current finding via 'gh issue create' or by editing the findings doc.`,
        };
      }
      return { kind: "allow" };
    }
  }

  return { kind: "allow" };
}

// ---------------------------------------------------------------------------
// Production effects (filesystem + Bun.spawn)
// ---------------------------------------------------------------------------

export async function readState(stateFile: string): Promise<RedSweepState | null> {
  if (!existsSync(stateFile)) return null;
  try {
    const text = await Bun.file(stateFile).text();
    return JSON.parse(text) as RedSweepState;
  } catch {
    return null;
  }
}

export async function writeState(stateFile: string, state: RedSweepState): Promise<void> {
  await Bun.write(stateFile, JSON.stringify(state, null, 2));
}

export function makeEffects(state: RedSweepState, cwd: string): Effects {
  return {
    async countTests(file: string): Promise<number> {
      if (!existsSync(file)) return 0;
      const markerSrc = state.test_marker_regex ?? "^\\s*(it|test)\\s*\\(";
      const re = new RegExp(markerSrc, "gm");
      const text = await Bun.file(file).text();
      return (text.match(re) ?? []).length;
    },
    async runSingleFileTests(file: string): Promise<number> {
      if (!state.test_cmd_single) return 0;
      const cmd = state.test_cmd_single.replaceAll("{file}", file);
      const proc = Bun.spawn(["bash", "-c", cmd], { cwd, stdout: "ignore", stderr: "ignore" });
      return await proc.exited;
    },
  };
}

// ---------------------------------------------------------------------------
// Hook entry point
// ---------------------------------------------------------------------------

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  const decoder = new TextDecoder();
  for await (const chunk of Bun.stdin.stream()) chunks.push(chunk);
  return chunks.map((c) => decoder.decode(c)).join("");
}

function emitDeny(reason: string): never {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  }));
  process.exit(2);
}

function emitBlockStop(reason: string): never {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(2);
}

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
  if (!state) process.exit(0); // INIT (no state file) — agent is still configuring.

  const decision = await handleHookEvent(event, input, state, makeEffects(state, cwd));

  if (decision.newState) await writeState(stateFile, decision.newState);

  switch (decision.kind) {
    case "allow":
      process.exit(0);
    case "deny":
      emitDeny(decision.reason);
    case "block-stop":
      emitBlockStop(decision.reason);
  }
}

// Only run main() when invoked as a script, not when imported by tests.
if (import.meta.main) {
  main().catch((err) => {
    process.stderr.write(`state-machine.ts error: ${err?.message ?? err}\n`);
    // Fail open — never wedge the user.
    process.exit(0);
  });
}
