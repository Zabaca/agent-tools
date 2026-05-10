/**
 * Project-local Playwright `test` re-export.
 *
 * Today this is a passthrough — specs import from this file rather
 * than from `@playwright/test` directly so future per-project fixtures
 * (admin auth cookie, customer cookie, multi-context page pairs) can
 * be added in one place without rewriting every spec.
 *
 * When you add a fixture, extend the base `test` rather than replacing
 * it, and document the fixture in `.claude/skills/worktree/SKILL.md`
 * so future agents know it exists.
 */
export { test, expect } from '@playwright/test';
