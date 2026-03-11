import { join, resolve } from "node:path";
import { pluginSchema } from "./schemas/plugin.ts";
import { marketplaceSchema } from "./schemas/marketplace.ts";
import { hooksFileSchema } from "./schemas/hooks.ts";
import { commandFrontmatterSchema } from "./schemas/command.ts";
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

export async function validatePlugin(dir: string): Promise<ValidationResult> {
  const root = resolve(dir);
  const errors: ValidationError[] = [];
  const filesChecked: string[] = [];

  // ── 1. plugin.json ──────────────────────────────────────────────
  const pluginPath = join(root, ".claude-plugin", "plugin.json");
  let pluginData: Record<string, unknown> | null = null;

  if (await fileExists(pluginPath)) {
    filesChecked.push(pluginPath);
    try {
      const raw = await readJson(pluginPath);
      const result = pluginSchema.safeParse(raw);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            file: pluginPath,
            field: issue.path.join(".") || undefined,
            message: issue.message,
          });
        }
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

  // ── 2. marketplace.json ─────────────────────────────────────────
  const marketplacePath = join(root, ".claude-plugin", "marketplace.json");

  if (await fileExists(marketplacePath)) {
    filesChecked.push(marketplacePath);
    try {
      const raw = await readJson(marketplacePath);
      const result = marketplaceSchema.safeParse(raw);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            file: marketplacePath,
            field: issue.path.join(".") || undefined,
            message: issue.message,
          });
        }
      }
    } catch (e) {
      errors.push({
        file: marketplacePath,
        message: `Failed to read/parse JSON: ${(e as Error).message}`,
      });
    }
  }

  // ── 3. hooks.json ───────────────────────────────────────────────
  let hooksPaths: string[] = [];
  if (pluginData?.hooks) {
    if (typeof pluginData.hooks === "string") {
      hooksPaths = [join(root, pluginData.hooks as string)];
    } else if (Array.isArray(pluginData.hooks)) {
      hooksPaths = (pluginData.hooks as string[]).map((p) => join(root, p));
    }
    // If hooks is an inline object, it was already validated as part of plugin.json
  } else {
    // Default: check for hooks.json at root
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
          for (const issue of result.error.issues) {
            errors.push({
              file: hooksPath,
              field: issue.path.join(".") || undefined,
              message: issue.message,
            });
          }
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

  // ── 4. Command files ────────────────────────────────────────────
  let commandPaths: string[] = [];

  if (pluginData?.commands) {
    const cmds = Array.isArray(pluginData.commands)
      ? (pluginData.commands as string[])
      : [pluginData.commands as string];
    commandPaths = cmds.map((p) => join(root, p));
  } else {
    // Discover commands/*.md
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
            for (const issue of result.error.issues) {
              errors.push({
                file: cmdPath,
                field: issue.path.join(".") || undefined,
                message: issue.message,
              });
            }
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

  return {
    valid: errors.length === 0,
    errors,
    filesChecked,
  };
}
