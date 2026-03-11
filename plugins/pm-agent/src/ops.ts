import { eq, like, and, isNull } from "drizzle-orm";
import { db } from "./db/index.ts";
import { entities, problems, entityProblems, solutions, stateTransitions, tasks, pipeline } from "./db/schema.ts";
import { createActor } from "xstate";
import { problemMachine } from "./machines/problem.ts";

// ── Database operations ──

export async function resetAll() {
  await db.delete(pipeline);
  await db.delete(tasks);
  await db.delete(stateTransitions);
  await db.delete(solutions);
  await db.delete(entityProblems);
  await db.delete(problems);
  await db.delete(entities);
}

// ── Entity operations ──

export async function listEntities() {
  return await db.query.entities.findMany({
    with: { parent: true },
  });
}

export async function getEntityTree() {
  return await db.query.entities.findMany({
    where: isNull(entities.parentId),
    with: {
      children: {
        with: {
          children: {
            with: {
              children: true,
            },
          },
        },
      },
    },
  });
}

export async function addEntity(name: string, parentId?: string, description?: string) {
  const rows = await db.insert(entities).values({ name, parentId, description }).returning();
  return rows[0]!;
}

export async function updateEntity(id: string, data: { name?: string; description?: string }) {
  const rows = await db.update(entities)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(entities.id, id))
    .returning();
  return rows[0];
}

export async function findEntity(query: string) {
  return await db.query.entities.findMany({
    where: like(entities.name, `%${query}%`),
    with: { parent: true },
  });
}

// ── Problem operations ──

export async function listProblems(state?: string) {
  return await db.query.problems.findMany({
    ...(state ? { where: eq(problems.state, state) } : {}),
    with: {
      entityProblems: {
        with: { entity: true },
      },
    },
  });
}

export async function getProblem(id: string) {
  return await db.query.problems.findFirst({
    where: eq(problems.id, id),
    with: {
      entityProblems: {
        with: { entity: true },
      },
    },
  });
}

export async function addProblem(data: {
  title: string;
  description?: string;
  impact?: string;
  opportunity?: string;
  state?: string;
}) {
  const rows = await db.insert(problems).values(data).returning();
  return rows[0]!;
}

export async function updateProblem(id: string, data: {
  title?: string;
  description?: string;
  impact?: string;
  opportunity?: string;
}) {
  const rows = await db.update(problems)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(problems.id, id))
    .returning();
  return rows[0];
}

export async function transitionProblem(id: string, event: string) {
  const problem = await getProblem(id);
  if (!problem) throw new Error(`Problem ${id} not found`);

  // Validate transition via XState
  const actor = createActor(problemMachine, {
    snapshot: problemMachine.resolveState({
      value: problem.state,
      context: { problemId: problem.id, title: problem.title },
    }),
  });
  actor.start();

  const before = actor.getSnapshot().value;
  actor.send({ type: event } as any);
  const after = actor.getSnapshot().value;
  actor.stop();

  if (before === after) {
    throw new Error(`Invalid transition: cannot send ${event} from state "${before}"`);
  }

  await db.update(problems)
    .set({ state: after as string, updatedAt: new Date() })
    .where(eq(problems.id, id));

  return await getProblem(id);
}

export async function findProblems(query: string) {
  return await db.query.problems.findMany({
    where: like(problems.title, `%${query}%`),
    with: {
      entityProblems: {
        with: { entity: true },
      },
    },
  });
}

// ── Assignment operations ──

export async function linkProblem(problemId: string, entityId: string) {
  const problem = await getProblem(problemId);
  if (!problem) throw new Error(`Problem ${problemId} not found`);
  const entity = await db.query.entities.findFirst({ where: eq(entities.id, entityId) });
  if (!entity) throw new Error(`Entity ${entityId} not found`);

  const rows = await db.insert(entityProblems)
    .values({ problemId, entityId })
    .returning();
  return rows[0]!;
}

export async function unlinkProblem(problemId: string, entityId: string) {
  await db.delete(entityProblems)
    .where(and(
      eq(entityProblems.problemId, problemId),
      eq(entityProblems.entityId, entityId),
    ));
}

// ── Solution operations ──

export async function listSolutions(problemId?: string) {
  return await db.query.solutions.findMany({
    ...(problemId ? { where: eq(solutions.problemId, problemId) } : {}),
    with: { problem: true, tasks: true },
  });
}

export async function getSolution(id: string) {
  return await db.query.solutions.findFirst({
    where: eq(solutions.id, id),
    with: {
      problem: true,
      tasks: {
        with: {
          children: true,
          entity: true,
        },
      },
    },
  });
}

export async function addSolution(data: {
  title: string;
  description?: string;
  problemId: string;
}) {
  const rows = await db.insert(solutions).values(data).returning();
  const solution = rows[0]!;
  await db.insert(stateTransitions).values({
    solutionId: solution.id,
    fromState: null,
    toState: "proposed",
  });
  return solution;
}

export async function updateSolution(id: string, data: {
  title?: string;
  description?: string;
  state?: string;
  reason?: string;
}) {
  // If state is changing, log the transition
  if (data.state) {
    const current = await db.query.solutions.findFirst({
      where: eq(solutions.id, id),
    });
    if (current && current.state !== data.state) {
      await db.insert(stateTransitions).values({
        solutionId: id,
        fromState: current.state,
        toState: data.state,
        reason: data.reason,
      });
    }
  }

  const rows = await db.update(solutions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(solutions.id, id))
    .returning();
  return rows[0];
}

export async function listTransitions(solutionId: string) {
  return await db.query.stateTransitions.findMany({
    where: eq(stateTransitions.solutionId, solutionId),
  });
}

// ── Task operations ──

export async function listTasks(opts?: { solutionId?: string; parentId?: string; state?: string }) {
  const conditions = [];
  if (opts?.solutionId) conditions.push(eq(tasks.solutionId, opts.solutionId));
  if (opts?.parentId) conditions.push(eq(tasks.parentId, opts.parentId));
  if (opts?.state) conditions.push(eq(tasks.state, opts.state));
  if (!opts?.parentId && !opts?.solutionId && !opts?.state) {
    // default: top-level tasks only
    conditions.push(isNull(tasks.parentId));
  }

  return await db.query.tasks.findMany({
    where: conditions.length === 1 ? conditions[0] : and(...conditions),
    with: {
      children: { with: { children: true, entity: true } },
      entity: true,
      solution: { with: { problem: true } },
    },
    orderBy: tasks.position,
  });
}

export async function getTask(id: string) {
  return await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
    with: {
      children: { with: { children: true, entity: true } },
      entity: true,
      solution: { with: { problem: true } },
      parent: true,
    },
  });
}

export async function addTask(data: {
  title: string;
  description?: string;
  solutionId?: string;
  parentId?: string;
  entityId?: string;
  position?: number;
}) {
  const rows = await db.insert(tasks).values(data).returning();
  return rows[0]!;
}

export async function updateTask(id: string, data: {
  title?: string;
  description?: string;
  state?: string;
  entityId?: string;
  position?: number;
}) {
  const rows = await db.update(tasks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();
  return rows[0];
}

// ── Pipeline operations ──

export async function startPipeline(solutionId: string) {
  const solution = await getSolution(solutionId);
  if (!solution) throw new Error(`Solution ${solutionId} not found`);
  if (solution.state !== "accepted") throw new Error(`Solution must be accepted (current: ${solution.state})`);

  const rows = await db.insert(pipeline).values({ solutionId }).returning();
  return rows[0]!;
}

export async function updatePipeline(solutionId: string, data: { state?: string; outcome?: string }) {
  const rows = await db.update(pipeline)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(pipeline.solutionId, solutionId))
    .returning();
  const result = rows[0];
  if (!result) throw new Error(`No pipeline entry for solution ${solutionId}`);
  return result;
}

export async function getPipeline(solutionId: string) {
  return await db.query.pipeline.findFirst({
    where: eq(pipeline.solutionId, solutionId),
    with: {
      solution: { with: { problem: true } },
    },
  });
}

export async function listPipeline(state?: string) {
  return await db.query.pipeline.findMany({
    ...(state ? { where: eq(pipeline.state, state) } : {}),
    with: {
      solution: { with: { problem: true } },
    },
  });
}

export async function listBacklog() {
  const accepted = await db.query.solutions.findMany({
    where: eq(solutions.state, "accepted"),
    with: { problem: true, pipeline: true },
  });
  return accepted.filter((s) => !s.pipeline);
}
