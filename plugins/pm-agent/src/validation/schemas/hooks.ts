import { z } from "zod";

/** All 14 Claude Code hook event types */
const VALID_EVENT_TYPES = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PermissionRequest",
  "PostToolUse",
  "PostToolUseFailure",
  "Notification",
  "SubagentStart",
  "SubagentStop",
  "Stop",
  "TeammateIdle",
  "TaskCompleted",
  "PreCompact",
  "SessionEnd",
] as const;

export const hookEventType = z.enum(VALID_EVENT_TYPES);

export type HookEventType = z.infer<typeof hookEventType>;

/** Individual hook handler */
export const hookHandlerSchema = z
  .object({
    type: z.enum(["command", "prompt", "agent"]),
    command: z.string().optional(),
    prompt: z.string().optional(),
    timeout: z.number().positive().optional(),
    statusMessage: z.string().optional(),
    async: z.boolean().optional(),
    once: z.boolean().optional(),
    model: z.string().optional(),
  })
  .refine(
    (h) => {
      if (h.type === "command") return !!h.command;
      if (h.type === "prompt") return !!h.prompt;
      return true;
    },
    {
      message:
        'type "command" requires a command field; type "prompt" requires a prompt field',
    }
  );

/** Matcher group: optional matcher + array of hook handlers */
export const matcherGroupSchema = z.object({
  matcher: z.string().optional(),
  hooks: z.array(hookHandlerSchema),
});

/** Top-level hooks.json schema */
export const hooksFileSchema = z.object({
  description: z.string().optional(),
  hooks: z
    .record(z.string(), z.array(matcherGroupSchema))
    .superRefine((obj, ctx) => {
      for (const key of Object.keys(obj)) {
        if (!(VALID_EVENT_TYPES as readonly string[]).includes(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid hook event type: "${key}". Valid types: ${VALID_EVENT_TYPES.join(", ")}`,
            path: [key],
          });
        }
      }
    }),
});
