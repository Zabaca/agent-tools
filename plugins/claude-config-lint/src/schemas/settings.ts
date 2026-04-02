import { z } from "zod";
import { VALID_EVENT_TYPES, matcherGroupSchema } from "./hooks.ts";

/** Permission allow/deny arrays */
const permissionsSchema = z.object({
  allow: z.array(z.string()).optional(),
  deny: z.array(z.string()).optional(),
});

/** Hooks within settings — same structure as hooks.json but inline */
const settingsHooksSchema = z
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
  });

/**
 * settings.json / settings.local.json schema.
 * Uses .passthrough() at top level since Claude Code adds fields often,
 * but validates known nested structures strictly.
 */
export const settingsSchema = z
  .object({
    permissions: permissionsSchema.optional(),
    hooks: settingsHooksSchema.optional(),
    env: z.record(z.string(), z.string()).optional(),
    statusLine: z.unknown().optional(),
    model: z.string().optional(),
    theme: z.string().optional(),
    preferredNotifChannel: z.string().optional(),
    verbose: z.boolean().optional(),
  })
  .passthrough();
