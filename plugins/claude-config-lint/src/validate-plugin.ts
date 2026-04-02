import { join, resolve } from "node:path";
import { pluginSchema } from "./schemas/plugin.ts";
import { marketplaceSchema } from "./schemas/marketplace.ts";
import { hooksFileSchema } from "./schemas/hooks.ts";
import { commandFrontmatterSchema } from "./schemas/command.ts";
import { skillFrontmatterSchema } from "./schemas/skill.ts";
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

/** Validate a Claude Code plugin directory */
export async function validatePlugin(dir: string): Promise<ValidationResult> {
  const root = resolve(dir);
  const errors: ValidationError[] = [];
  const filesChecked: string[] = [];

  // 1. plugin.json
  const pluginPath = join(root, ".claude-plugin", "plugin.json");
  let pluginData: Record<string, unknown> | null = null;

  if (await fileExists(pluginPath)) {
    filesChecked.push(pluginPath);
    try {
      const raw = await readJson(pluginPath);
      const result = pluginSchema.safeParse(raw);
      if (!result.success) {
        collectZodErrors(result, pluginPath, errors);
      } else {
        pluginData = raw as Record<string, unknown>;
      }
    } catch (e) {
      errors.push({
        file: pluginPath,
        message: `Failed to read/parse JSON: ${(e as Error).message}`,
      });
    }
  }

  // 2. marketplace.json
  const marketplacePath = join(root, ".claude-plugin", "marketplace.json");
  if (await fileExists(marketplacePath)) {
    filesChecked.push(marketplacePath);
    try {
      const raw = await readJson(marketplacePath);
      const result = marketplaceSchema.safeParse(raw);
      if (!result.success) {
        collectZodErrors(result, marketplacePath, errors);
      }
    } catch (e) {
      errors.push({
        file: marketplacePath,
        message: `Failed to read/parse JSON: ${(e as Error).message}`,
      });
    }
  }

  // 3. hooks.json
  let hooksPaths: string[] = [];
  if (pluginData?.hooks) {
    if (typeof pluginData.hooks === "string") {
      hooksPaths = [join(root, pluginData.hooks as string)];
    } else if (Array.isArray(pluginData.hooks)) {
      hooksPaths = (pluginData.hooks as string[]).map((p) => join(root, p));
    }
  } else {
    const defaultHooks = join(root, "hooks.json");
    if (await fileExists(defaultHooks)) {
      hooksPaths = [defaultHooks];
    }
  }

  for (const hooksPath of hooksPaths) {
    if (await fileExists(hooksPath)) {
      filesChecked.push(hooksPath);
      try {
        const raw = await readJson(hooksPath);
        const result = hooksFileSchema.safeParse(raw);
        if (!result.success) {
          collectZodErrors(result, hooksPath, errors);
        }
      } catch (e) {
        errors.push({
          file: hooksPath,
          message: `Failed to read/parse JSON: ${(e as Error).message}`,
        });
      }
    } else {
      errors.push({
        file: hooksPath,
        message: "Referenced hooks file does not exist",
      });
    }
  }

  // 4. Commands
  let commandPaths: string[] = [];
  if (pluginData?.commands) {
    const cmds = Array.isArray(pluginData.commands)
      ? (pluginData.commands as string[])
      : [pluginData.commands as string];
    commandPaths = cmds.map((p) => join(root, p));
  } else {
    const glob = new Bun.Glob("commands/*.md");
    for await (const file of glob.scan({ cwd: root })) {
      commandPaths.push(join(root, file));
    }
  }

  for (const cmdPath of commandPaths) {
    if (await fileExists(cmdPath)) {
      filesChecked.push(cmdPath);
      try {
        const raw = await readText(cmdPath);
        const { data } = parseFrontmatter(raw);
        if (Object.keys(data).length > 0) {
          const result = commandFrontmatterSchema.safeParse(data);
          if (!result.success) {
            collectZodErrors(result, cmdPath, errors);
          }
        }
      } catch (e) {
        errors.push({
          file: cmdPath,
          message: `Failed to read command file: ${(e as Error).message}`,
        });
      }
    } else {
      errors.push({
        file: cmdPath,
        message: "Referenced command file does not exist",
      });
    }
  }

  // 5. Skills
  await validateFrontmatterGlob(root, "skills/*/SKILL.md", skillFrontmatterSchema, errors, filesChecked);

  // 6. Agents
  await validateFrontmatterGlob(root, "agents/*.md", agentFrontmatterSchema, errors, filesChecked);

  return {
    valid: errors.length === 0,
    errors,
    filesChecked,
  };
}
