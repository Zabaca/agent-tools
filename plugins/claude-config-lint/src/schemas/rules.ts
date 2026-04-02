import { z } from "zod";

/** Schema for rules .md frontmatter */
export const rulesFrontmatterSchema = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    scope: z.enum(["global", "project"]).optional(),
    globs: z.string().optional(),
  })
  .strict();
