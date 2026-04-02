import { join, resolve } from "node:path";
import { mcpFileSchema } from "./schemas/mcp.ts";
import { settingsSchema } from "./schemas/settings.ts";
import { rulesFrontmatterSchema } from "./schemas/rules.ts";
import { skillFrontmatterSchema } from "./schemas/skill.ts";
import { commandFrontmatterSchema } from "./schemas/command.ts";
import { agentFrontmatterSchema } from "./schemas/agent.ts";
import { parseFrontmatter } from "./frontmatter.ts";
import type { ValidationResult, ValidationError } from "./types.ts";

async function fileExists(path: string): Promise<boolean> {
  return Bun.file(path).exists();
}

async function readJson(path: string): Promise<unknown> {
  return Bun.file(path).json();
}

async function readText(path: string): Promise<string> {
  return Bun.file(path).text();
}

function collectZodErrors(
  result: { success: false; error: { issues: Array<{ path: (string | number)[]; message: string }> } },
  file: string,
  errors: ValidationError[]
) {
  for (const issue of result.error.issues) {
    errors.push({
      file,
      field: issue.path.join(".") || undefined,
      message: issue.message,
    });
  }
}

async function validateJsonFile(
  path: string,
  schema: { safeParse: (data: unknown) => any },
  errors: ValidationError[],
  filesChecked: string[]
) {
  if (!(await fileExists(path))) return;
  filesChecked.push(path);
  try {
    const raw = await readJson(path);
    const result = schema.safeParse(raw);
    if (!result.success) {
      collectZodErrors(result, path, errors);
    }
  } catch (e) {
    errors.push({
      file: path,
      message: `Failed to read/parse JSON: ${(e as Error).message}`,
    });
  }
}

async function validateFrontmatterGlob(
  root: string,
  pattern: string,
  schema: { safeParse: (data: unknown) => any },
  errors: ValidationError[],
  filesChecked: string[]
) {
  const glob = new Bun.Glob(pattern);
  for await (const file of glob.scan({ cwd: root })) {
    const fullPath = join(root, file);
    filesChecked.push(fullPath);
    try {
      const raw = await readText(fullPath);
      const { data } = parseFrontmatter(raw);
      if (Object.keys(data).length > 0) {
        const result = schema.safeParse(data);
        if (!result.success) {
          collectZodErrors(result, fullPath, errors);
        }
      }
    } catch (e) {
      errors.push({
        file: fullPath,
        message: `Failed to read file: ${(e as Error).message}`,
      });
    }
  }
}

/** Validate a Claude Code project directory */
export async function validateProject(dir: string): Promise<ValidationResult> {
  const root = resolve(dir);
  const errors: ValidationError[] = [];
  const filesChecked: string[] = [];

  // 1. .mcp.json
  await validateJsonFile(join(root, ".mcp.json"), mcpFileSchema, errors, filesChecked);

  // 2. .claude/settings.json
  await validateJsonFile(join(root, ".claude", "settings.json"), settingsSchema, errors, filesChecked);

  // 3. .claude/settings.local.json
  await validateJsonFile(join(root, ".claude", "settings.local.json"), settingsSchema, errors, filesChecked);

  // 4. Rules: .claude/rules/*.md
  await validateFrontmatterGlob(root, ".claude/rules/*.md", rulesFrontmatterSchema, errors, filesChecked);

  // 5. Skills: .claude/skills/*/SKILL.md
  await validateFrontmatterGlob(root, ".claude/skills/*/SKILL.md", skillFrontmatterSchema, errors, filesChecked);

  // 6. Commands: .claude/commands/*.md
  await validateFrontmatterGlob(root, ".claude/commands/*.md", commandFrontmatterSchema, errors, filesChecked);

  // 7. Agents: .claude/agents/*.md
  await validateFrontmatterGlob(root, ".claude/agents/*.md", agentFrontmatterSchema, errors, filesChecked);

  return {
    valid: errors.length === 0,
    errors,
    filesChecked,
  };
}
