import { z } from "zod";

/** Schema for skill SKILL.md frontmatter */
export const skillFrontmatterSchema = z
  .object({
    name: z
      .string()
      .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, "Must be kebab-case")
      .max(64)
      .optional(),
    description: z.string().max(250).optional(),
    model: z.string().optional(),
    effort: z.string().optional(),
    context: z.literal("fork").optional(),
    paths: z.string().optional(),
    shell: z.string().optional(),
    "allowed-tools": z.string().optional(),
    "user-invocable": z.boolean().optional(),
    "argument-hint": z.string().optional(),
  })
  .strict();
