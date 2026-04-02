#!/usr/bin/env bun
import { resolve } from "node:path";
import { validateProject } from "./validate-project.ts";
import { validatePlugin } from "./validate-plugin.ts";
import { formatResult } from "./format.ts";

const args = process.argv.slice(2);
const isPlugin = args.includes("--plugin");
const dir = resolve(args.find((a) => !a.startsWith("--")) ?? ".");

const mode = isPlugin ? "plugin" : "project";
const result = isPlugin
  ? await validatePlugin(dir)
  : await validateProject(dir);

formatResult(result, mode);
process.exit(result.valid ? 0 : 1);
