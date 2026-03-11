import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

// Tables

export const entities = sqliteTable("entities", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description"),
  parentId: text("parent_id").references((): any => entities.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const problems = sqliteTable("problems", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  title: text("title").notNull(),
  description: text("description"),
  impact: text("impact"),
  opportunity: text("opportunity"),
  state: text("state").notNull().default("identified"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const solutions = sqliteTable("solutions", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  title: text("title").notNull(),
  description: text("description"),
  problemId: text("problem_id").notNull().references(() => problems.id),
  state: text("state").notNull().default("proposed"),
  reason: text("reason"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const stateTransitions = sqliteTable("state_transitions", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  solutionId: text("solution_id").notNull().references(() => solutions.id),
  fromState: text("from_state"),
  toState: text("to_state").notNull(),
  reason: text("reason"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  title: text("title").notNull(),
  description: text("description"),
  solutionId: text("solution_id").references(() => solutions.id),
  parentId: text("parent_id").references((): any => tasks.id),
  entityId: text("entity_id").references(() => entities.id),
  state: text("state").notNull().default("pending"),
  position: integer("position").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const entityProblems = sqliteTable("entity_problems", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  entityId: text("entity_id").notNull().references(() => entities.id),
  problemId: text("problem_id").notNull().references(() => problems.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  unique().on(table.entityId, table.problemId),
]);

export const pipeline = sqliteTable("pipeline", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  solutionId: text("solution_id").notNull().references(() => solutions.id).unique(),
  state: text("state").notNull().default("in_progress"),
  outcome: text("outcome"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Relations

export const entitiesRelations = relations(entities, ({ one, many }) => ({
  parent: one(entities, {
    fields: [entities.parentId],
    references: [entities.id],
    relationName: "entityTree",
  }),
  children: many(entities, { relationName: "entityTree" }),
  entityProblems: many(entityProblems),
}));

export const problemsRelations = relations(problems, ({ many }) => ({
  entityProblems: many(entityProblems),
  solutions: many(solutions),
}));

export const solutionsRelations = relations(solutions, ({ one, many }) => ({
  problem: one(problems, { fields: [solutions.problemId], references: [problems.id] }),
  tasks: many(tasks),
  stateTransitions: many(stateTransitions),
  pipeline: one(pipeline),
}));

export const stateTransitionsRelations = relations(stateTransitions, ({ one }) => ({
  solution: one(solutions, { fields: [stateTransitions.solutionId], references: [solutions.id] }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  solution: one(solutions, { fields: [tasks.solutionId], references: [solutions.id] }),
  parent: one(tasks, {
    fields: [tasks.parentId],
    references: [tasks.id],
    relationName: "taskTree",
  }),
  children: many(tasks, { relationName: "taskTree" }),
  entity: one(entities, { fields: [tasks.entityId], references: [entities.id] }),
}));

export const pipelineRelations = relations(pipeline, ({ one }) => ({
  solution: one(solutions, { fields: [pipeline.solutionId], references: [solutions.id] }),
}));

export const entityProblemsRelations = relations(entityProblems, ({ one }) => ({
  entity: one(entities, { fields: [entityProblems.entityId], references: [entities.id] }),
  problem: one(problems, { fields: [entityProblems.problemId], references: [problems.id] }),
}));
