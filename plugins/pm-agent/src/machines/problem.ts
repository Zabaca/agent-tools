import { setup } from "xstate";

/**
 * Problem state machine — scaffold.
 *
 * States:
 *   identified → triaged → in_progress → resolved
 *                                       → wont_fix
 *
 * Transitions will be wired up in a future iteration.
 */
export const problemMachine = setup({
  types: {
    context: {} as {
      problemId: string;
      title: string;
    },
    events: {} as
      | { type: "TRIAGE" }
      | { type: "START" }
      | { type: "RESOLVE" }
      | { type: "WONT_FIX" }
      | { type: "REOPEN" },
  },
}).createMachine({
  id: "problem",
  initial: "identified",
  states: {
    identified: {
      on: {
        TRIAGE: "triaged",
      },
    },
    triaged: {
      on: {
        START: "in_progress",
        WONT_FIX: "wont_fix",
      },
    },
    in_progress: {
      on: {
        RESOLVE: "resolved",
        WONT_FIX: "wont_fix",
      },
    },
    resolved: {
      on: {
        REOPEN: "triaged",
      },
    },
    wont_fix: {
      on: {
        REOPEN: "triaged",
      },
    },
  },
});
