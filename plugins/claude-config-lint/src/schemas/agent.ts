import { z } from "zod";

/** Schema for agent .md frontmatter */
export const agentFrontmatterSchema = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    model: z.string().optional(),
    effort: z.string().optional(),
    tools: z.string().optional(),
    allowedTools: z.string().optional(),
    "allowed-tools": z.string().optional(),
    permissions: z.string().optional(),
    context: z.literal("fork").optional(),
    "user-invocable": z.boolean().optional(),
  })
  .strict();
