---
name: ast-grep
description: Use ast-grep (sg) for structural code search and rewrite when regex would miss context or match too much. Triggers when the user asks to find all instances of a syntactic pattern (functions matching a shape, hook calls, JSX components, exports), when refactoring needs AST-aware substitution, when validating that a code edit preserves a contract, or when grep output is too noisy because the literal text appears in strings/comments. Living doc — patterns and gotchas accumulate as I discover them.
---

# ast-grep

Cross-language structural search/rewrite built on tree-sitter. Installed via Homebrew (`brew install ast-grep`); both `sg` and `ast-grep` resolve to the same binary.

This skill captures what I've learned about using it well. Edit it as new patterns earn their keep.

## When to reach for it

- "Find all X" where X is a syntactic pattern, not a literal string. Examples: every React hook call, every async function exported from a directory, every place we call `getDb()`, every Server Component.
- Refactors that need AST-aware substitution. Renaming a function across declarations and call sites without touching string literals; converting `var` to `let`; replacing `useEffect(() => { ... }, [])` with `useMount(...)`.
- Validating an edit. "Did my change accidentally introduce a `console.log`?" — easier and more reliable than a regex.
- Multi-language repo. One tool covers TS, JS, Python, Go, JSON, etc.

When NOT:
- Plain text search where regex/ripgrep is enough — don't reach for ast-grep just because it exists.
- Need full type info or cross-file symbol resolution → that's LSP territory.
- One-off edits to a single file → just edit the file.

## Pattern syntax — the essentials

- **Literal nodes**: write the code as you'd write it. `useState(0)` matches calls to `useState` with literal `0`.
- **Single-node metavariable**: `$NAME` (capital letters by convention). Matches one AST node and captures it. `useState($DEFAULT)` matches `useState(0)`, `useState(null)`, etc.
- **Sequence metavariable**: `$$$` matches a sequence of nodes — function args, statements in a block, JSX children. `function $NAME($$$) { $$$ }` matches any function declaration.
- **Anonymous match**: `$_` matches a single node without capturing. Use when you need a placeholder you don't intend to refer to.
- **Multi-line patterns**: just write the pattern across multiple lines. Tree-sitter parses it the same way.
- **Language flag**: `--lang ts | tsx | js | jsx | py | go | json | ...`. Required for ambiguous cases (e.g., `.ts` could be TS or TSX-flavored).

## Common workflows

### Quick search

```sh
sg --pattern 'getDb()' --lang ts
sg --pattern 'useState($DEFAULT)' --lang tsx
sg --pattern 'export default async function $NAME($$$) { $$$ }' --lang tsx apps/web/
```

Add `-l` for files-with-matches only (like `grep -l`). Add `--json` for machine-readable output.

### Rewrite

```sh
sg --pattern 'var $NAME = $VAL' --rewrite 'let $NAME = $VAL' --lang js
```

Dry-run first by omitting `--update-all`; the tool prints proposed changes. Apply with `--update-all`.

### Debugging a pattern that doesn't match

`--debug-query` shows the parsed pattern AST. Compare to what your target code actually parses to. Most pattern failures are because a metavariable is in a position where tree-sitter expects a different node type.

```sh
sg --pattern 'defineCommand({ $$$ })' --debug-query --lang ts path/to/file.ts
```

If the pattern is wrong, the AST output makes it obvious. If the pattern looks right but still doesn't match, tree-sitter likely sees the target code differently than you think — often because of decorators, attributes, or wrapper nodes you didn't account for.

## Project config (sgconfig.yml)

For repeated patterns or codebase-specific rules, drop a `sgconfig.yml` at the repo root. Defines reusable rules with names. Lets you do `sg scan` and run them all. Worth adopting once you have 3+ patterns you keep typing.

## Gotchas

(Populated as I hit them. Empty for now.)

## Patterns that have earned their keep

(Populated as patterns prove useful enough to memorize. Empty for now.)
