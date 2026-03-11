import * as ops from "./ops.ts";
import { config, resolveConfig, initConfig, setConfig } from "./config.ts";
import { homedir } from "node:os";

const args = Bun.argv.slice(2);
const resource = args[0];
const action = args[1];

function flag(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
}

function out(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

function fail(msg: string): never {
  console.error(JSON.stringify({ error: msg }));
  process.exit(1);
}

try {
  if (resource === "status") {
    out({
      entities: await ops.getEntityTree(),
      problems: await ops.listProblems(),
      solutions: await ops.listSolutions(),
      tasks: await ops.listTasks(),
      pipeline: await ops.listPipeline(),
      backlog: await ops.listBacklog(),
    });
  } else if (resource === "reset") {
    await ops.resetAll();
    out({ ok: true, message: "All data cleared" });
  } else if (resource === "entity") {
    switch (action) {
      case "list":
        out(await ops.listEntities());
        break;
      case "tree":
        out(await ops.getEntityTree());
        break;
      case "add": {
        const name = args[2] ?? flag("name");
        if (!name) fail("Name required: entity add <name> [--parent <id>] [--description \"...\"]");
        out(await ops.addEntity(name, flag("parent"), flag("description")));
        break;
      }
      case "update": {
        const id = args[2];
        if (!id) fail("ID required: entity update <id> --name \"...\" --description \"...\"");
        const result = await ops.updateEntity(id, {
          name: flag("name"),
          description: flag("description"),
        });
        if (!result) fail(`Entity ${id} not found`);
        out(result);
        break;
      }
      case "find": {
        const query = args[2];
        if (!query) fail("Query required: entity find <query>");
        out(await ops.findEntity(query));
        break;
      }
      default:
        fail(`Unknown entity action: ${action}. Use: list, tree, add, update, find`);
    }
  } else if (resource === "problem") {
    switch (action) {
      case "list":
        out(await ops.listProblems(flag("state")));
        break;
      case "get": {
        const id = args[2];
        if (!id) fail("ID required: problem get <id>");
        const p = await ops.getProblem(id);
        if (!p) fail(`Problem ${id} not found`);
        out(p);
        break;
      }
      case "add": {
        const title = flag("title");
        if (!title) fail("Title required: problem add --title \"...\"");
        out(await ops.addProblem({
          title,
          description: flag("description"),
          impact: flag("impact"),
          opportunity: flag("opportunity"),
        }));
        break;
      }
      case "update": {
        const id = args[2];
        if (!id) fail("ID required: problem update <id> --field value");
        const result = await ops.updateProblem(id, {
          title: flag("title"),
          description: flag("description"),
          impact: flag("impact"),
          opportunity: flag("opportunity"),
        });
        if (!result) fail(`Problem ${id} not found`);
        out(result);
        break;
      }
      case "transition": {
        const id = args[2];
        const event = args[3];
        if (!id || !event) fail("Usage: problem transition <id> <EVENT>");
        out(await ops.transitionProblem(id, event));
        break;
      }
      case "find": {
        const query = args[2];
        if (!query) fail("Query required: problem find <query>");
        out(await ops.findProblems(query));
        break;
      }
      case "link": {
        const problemId = args[2];
        const entityId = args[3];
        if (!problemId || !entityId) fail("Usage: problem link <problem-id> <entity-id>");
        out(await ops.linkProblem(problemId, entityId));
        break;
      }
      case "unlink": {
        const problemId = args[2];
        const entityId = args[3];
        if (!problemId || !entityId) fail("Usage: problem unlink <problem-id> <entity-id>");
        await ops.unlinkProblem(problemId, entityId);
        out({ ok: true });
        break;
      }
      default:
        fail(`Unknown problem action: ${action}. Use: list, get, add, update, transition, find, link, unlink`);
    }
  } else if (resource === "solution") {
    switch (action) {
      case "list":
        out(await ops.listSolutions(flag("problem")));
        break;
      case "get": {
        const id = args[2];
        if (!id) fail("ID required: solution get <id>");
        const s = await ops.getSolution(id);
        if (!s) fail(`Solution ${id} not found`);
        out(s);
        break;
      }
      case "add": {
        const title = flag("title");
        const problemId = flag("problem");
        if (!title || !problemId) fail("Required: solution add --title \"...\" --problem <problem-id>");
        out(await ops.addSolution({ title, description: flag("description"), problemId }));
        break;
      }
      case "update": {
        const id = args[2];
        if (!id) fail("ID required: solution update <id> --field value");
        const result = await ops.updateSolution(id, {
          title: flag("title"),
          description: flag("description"),
          state: flag("state"),
          reason: flag("reason"),
        });
        if (!result) fail(`Solution ${id} not found`);
        out(result);
        break;
      }
      case "history": {
        const id = args[2];
        if (!id) fail("ID required: solution history <id>");
        out(await ops.listTransitions(id));
        break;
      }
      default:
        fail(`Unknown solution action: ${action}. Use: list, get, add, update, history`);
    }
  } else if (resource === "task") {
    switch (action) {
      case "list":
        out(await ops.listTasks({
          solutionId: flag("solution"),
          parentId: flag("parent"),
          state: flag("state"),
        }));
        break;
      case "get": {
        const id = args[2];
        if (!id) fail("ID required: task get <id>");
        const t = await ops.getTask(id);
        if (!t) fail(`Task ${id} not found`);
        out(t);
        break;
      }
      case "add": {
        const title = flag("title");
        if (!title) fail("Required: task add --title \"...\" [--solution <id>] [--parent <id>] [--entity <id>]");
        out(await ops.addTask({
          title,
          description: flag("description"),
          solutionId: flag("solution"),
          parentId: flag("parent"),
          entityId: flag("entity"),
          position: flag("position") ? parseInt(flag("position")!) : undefined,
        }));
        break;
      }
      case "update": {
        const id = args[2];
        if (!id) fail("ID required: task update <id> --field value");
        const result = await ops.updateTask(id, {
          title: flag("title"),
          description: flag("description"),
          state: flag("state"),
          entityId: flag("entity"),
          position: flag("position") ? parseInt(flag("position")!) : undefined,
        });
        if (!result) fail(`Task ${id} not found`);
        out(result);
        break;
      }
      default:
        fail(`Unknown task action: ${action}. Use: list, get, add, update`);
    }
  } else if (resource === "pipeline") {
    switch (action) {
      case "list":
        out(await ops.listPipeline(flag("state")));
        break;
      case "backlog":
        out(await ops.listBacklog());
        break;
      case "start": {
        const id = args[2];
        if (!id) fail("ID required: pipeline start <solution-id>");
        out(await ops.startPipeline(id));
        break;
      }
      case "update": {
        const id = args[2];
        if (!id) fail("ID required: pipeline update <solution-id> --state X [--outcome \"...\"]");
        out(await ops.updatePipeline(id, {
          state: flag("state"),
          outcome: flag("outcome"),
        }));
        break;
      }
      case "get": {
        const id = args[2];
        if (!id) fail("ID required: pipeline get <solution-id>");
        const p = await ops.getPipeline(id);
        if (!p) fail(`No pipeline entry for solution ${id}`);
        out(p);
        break;
      }
      default:
        fail(`Unknown pipeline action: ${action}. Use: list, backlog, start, update, get`);
    }
  } else if (resource === "config") {
    switch (action) {
      case "show": {
        const c = resolveConfig();
        out({
          url: c.url,
          syncUrl: c.syncUrl,
          authToken: c.authToken ? "***" : undefined,
          configDir: c.configDir,
          configPath: c.configPath,
          cwd: process.cwd(),
        });
        break;
      }
      case "set": {
        const url = flag("url");
        const syncUrl = flag("sync-url");
        const authToken = flag("auth-token");
        if (!url && !syncUrl && !authToken) fail("Usage: config set [--url <path>] [--sync-url <turso-url>] [--auth-token <token>]");
        const path = setConfig({ url, syncUrl, authToken });
        out({ ok: true, configPath: path });
        break;
      }
      case "init": {
        const isGlobal = args.includes("--global");
        const targetDir = isGlobal ? homedir() : process.cwd();
        const path = initConfig(targetDir);
        out({ ok: true, configPath: path });
        break;
      }
      default:
        fail(`Unknown config action: ${action}. Use: show, set, init`);
    }
  } else {
    fail(`Unknown resource: ${resource}. Use: problem, entity, solution, task, pipeline, config`);
  }
} catch (e: any) {
  fail(e.message);
}
