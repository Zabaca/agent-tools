import { z } from "zod";
import { kebabCase, semver, authorSchema, stringOrArray } from "./shared.ts";

export const pluginSchema = z
  .object({
    name: kebabCase,
    version: semver.optional(),
    description: z.string().optional(),
    author: authorSchema.optional(),
    homepage: z.string().url().optional(),
    repository: z.string().optional(),
    license: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    commands: stringOrArray.optional(),
    agents: stringOrArray.optional(),
    skills: stringOrArray.optional(),
    hooks: z.union([z.string(), z.array(z.string()), z.record(z.string(), z.unknown())]).optional(),
    mcpServers: z.record(z.string(), z.unknown()).optional(),
    outputStyles: z.unknown().optional(),
    lspServers: z.unknown().optional(),
  })
  .strict();
