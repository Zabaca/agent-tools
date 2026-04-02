---
name: lint
description: Validate Claude Code config files (.mcp.json, settings.json, frontmatter) with deterministic Zod schemas
user-invocable: true
argument-hint: "[path] [--plugin]"
---

# Claude Config Lint

Run the config linter to validate Claude Code configuration files.

## Usage

```bash
cd ${CLAUDE_PLUGIN_ROOT} && bun run src/cli.ts <path> [--plugin]
```

**Project mode** (default): validates `.mcp.json`, `.claude/settings.json`, rules/skills/commands/agents frontmatter.

**Plugin mode** (`--plugin`): validates `.claude-plugin/plugin.json`, `marketplace.json`, `hooks.json`, and command/skill/agent frontmatter.

## Instructions

1. Determine whether the user wants to validate a **project** or a **plugin**
2. Run the linter using the Bash tool
3. If errors are found, explain each one and suggest fixes
4. If valid, confirm the result

## Examples

```bash
# Validate current project
cd ${CLAUDE_PLUGIN_ROOT} && bun run src/cli.ts .

# Validate a specific project
cd ${CLAUDE_PLUGIN_ROOT} && bun run src/cli.ts ~/Projects/my-app

# Validate a plugin
cd ${CLAUDE_PLUGIN_ROOT} && bun run src/cli.ts ~/Projects/my-plugin --plugin
```
