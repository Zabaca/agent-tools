import { z } from "zod";

/** stdio MCP server */
const stdioServer = z.object({
  type: z.literal("stdio"),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  cwd: z.string().optional(),
});

/** SSE MCP server */
const sseServer = z.object({
  type: z.literal("sse"),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
});

/** Streamable HTTP MCP server */
const httpServer = z.object({
  type: z.literal("http"),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
  oauth: z.unknown().optional(),
});

/** Single MCP server entry — discriminated union on `type` */
export const mcpServerSchema = z.discriminatedUnion("type", [
  stdioServer,
  sseServer,
  httpServer,
]);

/** Top-level .mcp.json schema */
export const mcpFileSchema = z.object({
  mcpServers: z.record(z.string(), mcpServerSchema),
});
