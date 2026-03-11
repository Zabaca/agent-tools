import { isNull } from "drizzle-orm";
import { db } from "./db/index.ts";
import { entities, problems } from "./db/schema.ts";
import { createActor } from "xstate";
import { problemMachine } from "./machines/problem.ts";

async function main() {
  // Query entity tree (roots with children and grandchildren)
  const roots = await db.query.entities.findMany({
    where: isNull(entities.parentId),
    with: {
      children: {
        with: {
          children: true,
        },
      },
    },
  });

  console.log("=== Entity Tree ===");
  for (const root of roots) {
    console.log(root.name);
    for (const child of root.children) {
      console.log(`  ├── ${child.name}`);
      for (const grandchild of child.children) {
        console.log(`  │   ├── ${grandchild.name}`);
      }
    }
  }

  // Query problems with their entity links
  const allProblems = await db.query.problems.findMany({
    with: {
      entityProblems: {
        with: { entity: true },
      },
    },
  });

  console.log("\n=== Problems ===");
  for (const p of allProblems) {
    const entityNames = p.entityProblems.map((ep) => ep.entity.name).join(", ");
    console.log(`[${p.state}] ${p.title}`);
    if (p.impact) console.log(`  impact:      ${p.impact}`);
    if (p.opportunity) console.log(`  opportunity: ${p.opportunity}`);
    console.log(`  → affects: ${entityNames}`);
  }

  // Demo: run a problem through the state machine
  console.log("\n=== State Machine Demo ===");
  const demo = allProblems[0];
  if (demo) {
    const actor = createActor(problemMachine, {
      snapshot: problemMachine.resolveState({ value: demo.state, context: { problemId: demo.id, title: demo.title } }),
    });
    actor.start();

    console.log(`Problem: "${demo.title}"`);
    console.log(`  current state: ${actor.getSnapshot().value}`);

    actor.send({ type: "TRIAGE" });
    console.log(`  after TRIAGE:  ${actor.getSnapshot().value}`);

    actor.send({ type: "START" });
    console.log(`  after START:   ${actor.getSnapshot().value}`);

    actor.send({ type: "RESOLVE" });
    console.log(`  after RESOLVE: ${actor.getSnapshot().value}`);

    actor.stop();
  }
}

await main();
