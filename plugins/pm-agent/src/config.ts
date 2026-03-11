import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { homedir } from "node:os";

interface Config {
  url: string;
  syncUrl?: string;
  authToken?: string;
  configDir: string;
  configPath: string | null;
}

interface ConfigFile {
  url?: string;
  syncUrl?: string;
  authToken?: string;
}

const CONFIG_DIR_NAME = ".pm-agent";
const CONFIG_FILE_NAME = "config.json";

function findConfigDir(startDir: string): string | null {
  let dir = resolve(startDir);
  while (true) {
    const candidate = join(dir, CONFIG_DIR_NAME, CONFIG_FILE_NAME);
    if (existsSync(candidate)) return join(dir, CONFIG_DIR_NAME);
    const parent = dirname(dir);
    if (parent === dir) break; // reached root
    dir = parent;
  }
  return null;
}

export function resolveConfig(cwd?: string): Config {
  const startDir = cwd ?? process.cwd();

  // Walk up from cwd looking for .pm-agent/config.json
  let configDir = findConfigDir(startDir);
  let configPath: string | null = null;
  let fileConfig: ConfigFile = {};

  if (configDir) {
    configPath = join(configDir, CONFIG_FILE_NAME);
  } else {
    // Check global ~/.pm-agent/config.json
    const globalDir = join(homedir(), CONFIG_DIR_NAME);
    const globalPath = join(globalDir, CONFIG_FILE_NAME);
    if (existsSync(globalPath)) {
      configDir = globalDir;
      configPath = globalPath;
    }
  }

  // Parse config file if found
  if (configPath && existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(readFileSync(configPath, "utf-8"));
    } catch (_) {
      // Invalid JSON — treat as empty config
    }
  }

  // Default configDir to ~/.pm-agent/ if nothing found
  if (!configDir) {
    configDir = join(homedir(), CONFIG_DIR_NAME);
  }

  // Auth token precedence: env var > .authkey file > config file
  let authToken = process.env.PM_AGENT_AUTH_TOKEN;
  if (!authToken) {
    const keyPath = join(configDir, ".authkey");
    if (existsSync(keyPath)) {
      authToken = readFileSync(keyPath, "utf-8").trim() || undefined;
    }
  }
  if (!authToken) {
    authToken = fileConfig.authToken;
  }

  // url is always a local file path
  const url = fileConfig.url ?? `file:${join(configDir, "data.db")}`;
  const syncUrl = fileConfig.syncUrl;

  return { url, syncUrl, authToken, configDir, configPath };
}

export function initConfig(targetDir: string): string {
  const dir = join(targetDir, CONFIG_DIR_NAME);
  mkdirSync(dir, { recursive: true });
  const configPath = join(dir, CONFIG_FILE_NAME);
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify({}, null, 2) + "\n");
  }
  const gitignorePath = join(dir, ".gitignore");
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, "*.db\n*.db-shm\n*.db-wal\n.authkey\n");
  }
  return configPath;
}

export function setConfig(updates: { url?: string; syncUrl?: string; authToken?: string }): string {
  // Find nearest config or create global
  let configDir = findConfigDir(process.cwd());
  if (!configDir) {
    configDir = join(homedir(), CONFIG_DIR_NAME);
  }
  mkdirSync(configDir, { recursive: true });
  const configPath = join(configDir, CONFIG_FILE_NAME);

  if (updates.url !== undefined || updates.syncUrl !== undefined) {
    let existing: ConfigFile = {};
    if (existsSync(configPath)) {
      try {
        existing = JSON.parse(readFileSync(configPath, "utf-8"));
      } catch (_) {}
    }
    if (updates.url !== undefined) existing.url = updates.url;
    if (updates.syncUrl !== undefined) existing.syncUrl = updates.syncUrl;
    writeFileSync(configPath, JSON.stringify(existing, null, 2) + "\n");
  }

  if (updates.authToken !== undefined) {
    writeFileSync(join(configDir, ".authkey"), updates.authToken + "\n");
  }

  return configPath;
}

// Resolve once at module load time
export const config = resolveConfig();
