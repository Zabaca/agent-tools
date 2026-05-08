import { describe, test, expect } from "bun:test";
import {
  handleHookEvent,
  type Effects,
  type Event,
  type HookInput,
  type RedSweepState,
  type StateName,
} from "./state-machine.ts";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const baseState: RedSweepState = {
  state: "DISCOVERING",
  test_cmd_single: "fake-runner {file}",
  test_pattern: "*.test.ts",
  test_dir: "test",
  test_marker_regex: "^\\s*(it|test)\\s*\\(",
  tracker: "markdown",
  findings_file: "RED-SWEEP.md",
  focus: "security",
  scope: "src/",
  loop_limit: 10,
  finding_count: 0,
  stop_attempts: 0,
  current_test: "",
  baseline_test_count: 0,
  pending_test_file: "",
};

function makeFakeEffects(opts: { newCount?: number; testExitCode?: number } = {}): Effects {
  return {
    async countTests() {
      return opts.newCount ?? 0;
    },
    async runSingleFileTests() {
      return opts.testExitCode ?? 1; // default: tests fail (red)
    },
  };
}

interface Row {
  name: string;
  state: StateName;
  event: Event;
  toolName?: string; // documentation only — handler dispatches on event, not tool name
  toolInput?: HookInput["tool_input"];
  stateOverrides?: Partial<RedSweepState>;
  effects?: Effects;
  expect: "allow" | "deny" | "block-stop";
  expectReason?: string; // substring match
  expectState?: StateName;
  expectFindingCount?: number;
  expectStopAttempts?: number;
}

const rows: Row[] = [
  // ----- INIT: no enforcement -----
  {
    name: "INIT allows Write to source file",
    state: "INIT",
    event: "pre-write",
    toolName: "Write",
    toolInput: { file_path: "src/foo.ts" },
    expect: "allow",
  },
  {
    name: "INIT allows destructive bash",
    state: "INIT",
    event: "pre-bash",
    toolName: "Bash",
    toolInput: { command: "git commit -am wip" },
    expect: "allow",
  },
  {
    name: "INIT allows stop with zero findings",
    state: "INIT",
    event: "stop",
    expect: "allow",
  },

  // ----- DISCOVERING: Write/Edit gating -----
  {
    name: "DISCOVERING allows Write to test file matching pattern + dir",
    state: "DISCOVERING",
    event: "pre-write",
    toolName: "Write",
    toolInput: { file_path: "test/auth.test.ts" },
    expect: "allow",
  },
  {
    name: "DISCOVERING allows Edit on test file",
    state: "DISCOVERING",
    event: "pre-write", // Edit also dispatches via Write|Edit matcher
    toolName: "Edit",
    toolInput: { file_path: "test/nested/payments.test.ts" },
    expect: "allow",
  },
  {
    name: "DISCOVERING denies Write to source file",
    state: "DISCOVERING",
    event: "pre-write",
    toolName: "Write",
    toolInput: { file_path: "src/auth.ts" },
    expect: "deny",
    expectReason: "only test files may be edited",
  },
  {
    name: "DISCOVERING denies Edit to source file",
    state: "DISCOVERING",
    event: "pre-write",
    toolName: "Edit",
    toolInput: { file_path: "src/payments/charge.ts" },
    expect: "deny",
    expectReason: "only test files may be edited",
  },
  {
    name: "DISCOVERING denies test-file write that's not under test_dir",
    state: "DISCOVERING",
    event: "pre-write",
    toolName: "Write",
    toolInput: { file_path: "src/foo.test.ts" },
    expect: "deny",
    expectReason: "only test files may be edited",
  },
  {
    name: "DISCOVERING denies second test write while a finding is unfiled",
    state: "DISCOVERING",
    event: "pre-write",
    toolName: "Write",
    toolInput: { file_path: "test/other.test.ts" },
    stateOverrides: { current_test: "test/auth.test.ts" },
    expect: "deny",
    expectReason: "File the finding",
  },

  // ----- DISCOVERING: bash gating -----
  {
    name: "DISCOVERING allows ls",
    state: "DISCOVERING",
    event: "pre-bash",
    toolName: "Bash",
    toolInput: { command: "ls -la src/" },
    expect: "allow",
  },
  {
    name: "DISCOVERING allows cat",
    state: "DISCOVERING",
    event: "pre-bash",
    toolInput: { command: "cat src/auth.ts" },
    expect: "allow",
  },
  {
    name: "DISCOVERING allows git log",
    state: "DISCOVERING",
    event: "pre-bash",
    toolInput: { command: "git log --oneline -10" },
    expect: "allow",
  },
  {
    name: "DISCOVERING allows git diff",
    state: "DISCOVERING",
    event: "pre-bash",
    toolInput: { command: "git diff HEAD" },
    expect: "allow",
  },
  {
    name: "DISCOVERING denies git commit",
    state: "DISCOVERING",
    event: "pre-bash",
    toolInput: { command: "git commit -am wip" },
    expect: "deny",
    expectReason: "blocked",
  },
  {
    name: "DISCOVERING denies rm -rf",
    state: "DISCOVERING",
    event: "pre-bash",
    toolInput: { command: "rm -rf node_modules" },
    expect: "deny",
    expectReason: "blocked",
  },
  {
    name: "DISCOVERING denies plain rm",
    state: "DISCOVERING",
    event: "pre-bash",
    toolInput: { command: "rm tmp.txt" },
    expect: "deny",
  },

  // ----- POST-WRITE validation -----
  {
    name: "post-write +1 test that fails → allow + transition to FILING",
    state: "DISCOVERING",
    event: "post-write",
    toolInput: { file_path: "test/auth.test.ts" },
    stateOverrides: { baseline_test_count: 0 },
    effects: makeFakeEffects({ newCount: 1, testExitCode: 1 }),
    expect: "allow",
    expectState: "FILING",
  },
  {
    name: "post-write +2 tests → deny",
    state: "DISCOVERING",
    event: "post-write",
    toolInput: { file_path: "test/auth.test.ts" },
    stateOverrides: { baseline_test_count: 0 },
    effects: makeFakeEffects({ newCount: 2, testExitCode: 1 }),
    expect: "deny",
    expectReason: "Only ONE failing test",
  },
  {
    name: "post-write +1 test but passes → deny",
    state: "DISCOVERING",
    event: "post-write",
    toolInput: { file_path: "test/auth.test.ts" },
    stateOverrides: { baseline_test_count: 0 },
    effects: makeFakeEffects({ newCount: 1, testExitCode: 0 }),
    expect: "deny",
    expectReason: "must FAIL",
  },
  {
    name: "post-write +0 (helpers edited) → allow, no transition",
    state: "DISCOVERING",
    event: "post-write",
    toolInput: { file_path: "test/auth.test.ts" },
    stateOverrides: { baseline_test_count: 3 },
    effects: makeFakeEffects({ newCount: 3, testExitCode: 0 }),
    expect: "allow",
    expectState: "DISCOVERING",
  },
  {
    name: "post-write on non-test file → allow (out of scope)",
    state: "DISCOVERING",
    event: "post-write",
    toolInput: { file_path: "src/auth.ts" },
    effects: makeFakeEffects({ newCount: 99 }),
    expect: "allow",
  },

  // ----- FILING -----
  {
    name: "FILING allows gh issue create + transitions to DISCOVERING",
    state: "FILING",
    event: "pre-bash",
    toolInput: { command: 'gh issue create --title "x" --body "y"' },
    stateOverrides: { current_test: "test/auth.test.ts", finding_count: 0 },
    expect: "allow",
    expectState: "DISCOVERING",
    expectFindingCount: 1,
  },
  {
    name: "FILING allows write to findings markdown",
    state: "FILING",
    event: "pre-write",
    toolInput: { file_path: "RED-SWEEP.md" },
    expect: "allow",
  },
  {
    name: "FILING denies write to test file",
    state: "FILING",
    event: "pre-write",
    toolInput: { file_path: "test/other.test.ts" },
    expect: "deny",
    expectReason: "only the findings file",
  },
  {
    name: "FILING denies edit to source file",
    state: "FILING",
    event: "pre-write",
    toolInput: { file_path: "src/auth.ts" },
    expect: "deny",
    expectReason: "only the findings file",
  },
  {
    name: "FILING denies git commit",
    state: "FILING",
    event: "pre-bash",
    toolInput: { command: "git commit -am wip" },
    expect: "deny",
    expectReason: "blocked",
  },

  // ----- STOP gating -----
  {
    name: "STOP allowed when finding_count > 0",
    state: "DISCOVERING",
    event: "stop",
    stateOverrides: { finding_count: 3 },
    expect: "allow",
  },
  {
    name: "STOP blocked when finding_count == 0 and below loop_limit",
    state: "DISCOVERING",
    event: "stop",
    stateOverrides: { finding_count: 0, stop_attempts: 2, loop_limit: 5 },
    expect: "block-stop",
    expectReason: "attempt 3 of 5",
    expectStopAttempts: 3,
  },
  {
    name: "STOP allowed when finding_count == 0 but stop_attempts >= loop_limit",
    state: "DISCOVERING",
    event: "stop",
    stateOverrides: { finding_count: 0, stop_attempts: 10, loop_limit: 10 },
    expect: "allow",
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

describe("state machine", () => {
  for (const row of rows) {
    test(row.name, async () => {
      const state: RedSweepState = {
        ...baseState,
        ...row.stateOverrides,
        state: row.state,
      };
      const input: HookInput = {
        tool_name: row.toolName,
        tool_input: row.toolInput,
        cwd: "/repo",
      };
      const effects = row.effects ?? makeFakeEffects();

      const decision = await handleHookEvent(row.event, input, state, effects);

      expect(decision.kind).toBe(row.expect);

      if (row.expectReason && decision.kind !== "allow") {
        expect(decision.reason).toContain(row.expectReason);
      }

      if (row.expectState !== undefined) {
        const next = decision.newState ?? state;
        expect(next.state).toBe(row.expectState);
      }

      if (row.expectFindingCount !== undefined) {
        const next = decision.newState ?? state;
        expect(next.finding_count).toBe(row.expectFindingCount);
      }

      if (row.expectStopAttempts !== undefined) {
        const next = decision.newState ?? state;
        expect(next.stop_attempts).toBe(row.expectStopAttempts);
      }
    });
  }
});
