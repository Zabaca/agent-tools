import { z } from "zod";

const pluginSourceObject = z.object({
  source: z.enum(["github", "url"]),
  repo: z.string().optional(),
  url: z.string().url().optional(),
  ref: z.string().optional(),
  sha: z.string().optional(),
});

const pluginSource = z.union([z.string(), pluginSourceObject]);

const marketplacePlugin = z.object({
  name: z.string(),
  source: pluginSource,
  description: z.string().optional(),
  version: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

export const marketplaceSchema = z.object({
  $schema: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  owner: z.object({
    name: z.string(),
  }),
  plugins: z.array(marketplacePlugin),
  metadata: z
    .object({
      description: z.string().optional(),
      version: z.string().optional(),
      pluginRoot: z.string().optional(),
    })
    .optional(),
});
