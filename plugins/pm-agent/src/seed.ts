import { db } from "./db/index.ts";
import { entities, problems, entityProblems } from "./db/schema.ts";

function seed() {
  // Clean existing data (order matters for FK constraints)
  db.delete(entityProblems).run();
  db.delete(problems).run();
  db.delete(entities).run();

  // Create entity hierarchy:
  //   Acme Corp
  //   ├── Engineering
  //   │   ├── Backend
  //   │   └── Frontend
  //   └── Product

  const [acme] = db.insert(entities).values({ name: "Acme Corp" }).returning().all();

  const [engineering] = db.insert(entities).values({ name: "Engineering", parentId: acme!.id }).returning().all();

  const [backend] = db.insert(entities).values({ name: "Backend", parentId: engineering!.id }).returning().all();

  const [frontend] = db.insert(entities).values({ name: "Frontend", parentId: engineering!.id }).returning().all();

  const [product] = db.insert(entities).values({ name: "Product", parentId: acme!.id }).returning().all();

  // Create problems
  const [p1] = db.insert(problems).values({
    title: "API response times > 2s on /users endpoint",
    description: "P95 latency has degraded since last deploy",
    impact: "15% of users abandon checkout flow due to timeouts",
    opportunity: "Recovering those users = ~$40k MRR",
    state: "identified",
  }).returning().all();

  const [p2] = db.insert(problems).values({
    title: "Dashboard crashes on Safari 17",
    description: "TypeError in chart rendering library",
    impact: "Safari users (22% of traffic) see blank dashboard",
    opportunity: "Unblock enterprise clients who mandate Safari",
    state: "triaged",
  }).returning().all();

  const [p3] = db.insert(problems).values({
    title: "No onboarding flow for new teams",
    description: "Users churn within first 3 days without guidance",
    impact: "60% of new teams never complete setup",
    opportunity: "Guided onboarding could double activation rate",
    state: "identified",
  }).returning().all();

  // Link problems to entities (many-to-many)
  // p1 affects Backend
  db.insert(entityProblems).values({ entityId: backend!.id, problemId: p1!.id }).run();

  // p2 affects Frontend
  db.insert(entityProblems).values({ entityId: frontend!.id, problemId: p2!.id }).run();

  // p3 affects both Product and Engineering (cross-cutting)
  db.insert(entityProblems).values({ entityId: product!.id, problemId: p3!.id }).run();
  db.insert(entityProblems).values({ entityId: engineering!.id, problemId: p3!.id }).run();

  console.log("Seeded:");
  console.log(`  ${5} entities`);
  console.log(`  ${3} problems`);
  console.log(`  ${4} entity-problem links`);
}

seed();
