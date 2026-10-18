# Worked examples

Two real setups of the same method, for two very different kinds of
upstream. Borrow the shape that fits.

## zbc: an infra framework that vendors modules

`Zabaca/zbc` (`.claude/skills/consumer-mining/`, `scripts/consumer-survey.ts`,
`docs/consumers/registry.json`). About 20 consumers, in copy mode (files
copied once by `zbc add`) or subtree mode (a git subtree of the engine).

- **Vendored surface**: `packages/infra/modules/<name>/index.ts` in the
  consumer ← `packages/cli/templates/infra/modules/<name>/index.ts` upstream,
  matched by directory name. Also anything a consumer wrote inside the
  subtree prefix (`vendor/zbc/modules/`), which is the wrong place, and the
  survey sees it as novel.
- **Novel surface**: a module directory with no upstream template of that
  name at any revision.
- **Hatches**: provider CLIs (`wrangler`, `gcloud`, `flyctl`, `turso`,
  `aws`…) called outside `modules/`. That means nobody even tried to write a
  module, which points at `defineModule` itself rather than at any one module.
- **Interface signal**: the top-level keys of each module's
  `configSchema: z.object({…})` and `outputs`, brace-matched. Keys every
  implementation chose are the interface. Keys only some chose are config.
- **Exercised**: is the module wired into an instance in a `production`
  environment?
- **Cases**: one per module, plus engine-level cases where several modules'
  workarounds turned out to be the same missing engine feature (credential
  lifecycle, output wiring, eventual consistency). The engine cases were the
  real finding. Shipping the module cases without them would have rebuilt
  upstream exactly what consumers had already built by hand.
- **Output is checked in**: zbc's maintainers chose to commit
  `.consumer-survey/*.json` and the cases.

## croft: a CLI that writes agent texts into projects

`Zabaca/croft` (`.claude/skills/consumer-mining/`, `scripts/consumer-survey.ts`,
`docs/consumers/registry.json`). A TypeScript data-pipeline CLI. Consumers
are croft projects (a folder with `croft.json`), often a package inside a
bigger monorepo, so the registry carries `root`.

- **Vendored surface is text, not code**: `croft init` writes the agent
  skill (`.claude/skills/croft/SKILL.md`, stamped `<!-- croft 0.1.0 -->`),
  a managed block in `CLAUDE.md` between `<!-- croft:start` and
  `<!-- croft:end -->`, and an example asset. The stamp needs `--stamp`. The
  block is cut out of the consumer's CLAUDE.md before hashing, and the text
  *around* it is kept as the consumer's own guidance about the tool. The block
  has two template variants (project and app), and each is classified against
  its own history, so one variant's newer revision can't mark the other stale.
- **Novel surface**: everything outside `assets/` and the scaffold: `lib/`
  helpers, a `bin/croft` wrapper (one pulled secrets out of sops on every
  call), and the project's own skills about croft elsewhere in the repo.
- **Hatches**: `fetch(` beside `ctx.http`, hand-rolled `sleep`, subprocesses,
  opening the `.duckdb` file directly, `sops`, `process.env` beside
  `secret()`, filesystem reads outside a file ingest, cron/launchd beside
  `croft schedule`.
- **Notes**: comments that mention croft, a workaround or an API limit. On
  the first run these were the best evidence: "croft can't read PDFs",
  "CourtListener allows 50 requests an hour and 125 a day".
- **Interface signal**: each asset's top-level option keys and the context
  fields its `rows({ … })` destructures, tallied across projects. An option
  nobody uses is a finding too.
- **Exercised**: `.croft/runs.sqlite` from a checkout on the machine
  (gitignored, so never in a clone): failures grouped by asset and error
  code, retries, confirmations, schedules. An asset that failed the same way
  six times is evidence. One that never ran is opinion.
- **Version skew is the norm**: consumers pinned whole releases behind, so
  "still missing on main?" comes before every case (`git log
  croft-v<pin>..main`, grep the shipped docs).
- **Output is gitignored, cases included**: croft is public and its
  consumers are private.
