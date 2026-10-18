#!/usr/bin/env bun
/**
 * Is a consumer's copy of an upstream file theirs, or ours from last year?
 *
 * Hashes each consumer file against EVERY git revision of the upstream file it
 * came from, once verbatim and once normalised (quote style, trailing ; and ,
 * indentation, blank lines and CRLF stripped; comments kept, since a consumer's
 * comment is often the finding):
 *
 *   current    matches the newest revision           → nothing to learn
 *   stale      matches an older revision             → upgrade debt, not feedback
 *   divergent  matches none; nearestRev is the closest → their edit, diff against nearestRev
 *   removed    the consumer file does not exist
 *
 * Usage:
 *   bun ancestry.ts --upstream <repo> --template <path in repo> [--stamp <regex> --stamp-as <text>] <consumer file>...
 *
 * --stamp rewrites a generated line (a version stamp, a project name) in the
 * consumer file back to the template's placeholder before hashing, so a file
 * stamped "0.1.0" still matches the template that wrote it.
 *
 * Prints one JSON object per consumer file. upstreamFirstSeen and
 * consumerFirstSeen (when the consumer file is in a git repo) answer "which side
 * is older": when the consumer's file predates the template, divergent is a
 * convergence of two independent implementations, not a fork.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname } from 'node:path'

export type Verdict = 'current' | 'stale' | 'divergent' | 'removed'

export interface Revision {
  rev: string
  date: string
  hash: string
  normalizedHash: string
  content: string
}

export interface Classification {
  verdict: Verdict
  formattingOnly?: boolean
  matchedRev?: string
  nearestRev?: string
  similarity?: number
}

export const hash = (s: string) => createHash('sha256').update(s).digest('hex')

export function normalize(source: string): string {
  return source
    .replace(/\r\n/g, '\n')
    .replace(/"/g, "'")
    .split('\n')
    .map((l) => l.trim().replace(/[;,]+$/, ''))
    .filter((l) => l.length > 0)
    .join('\n')
}

export function revision(rev: string, content: string, date = ''): Revision {
  return { rev, date, hash: hash(content), normalizedHash: hash(normalize(content)), content }
}

/** Jaccard overlap of non-blank trimmed lines. Only used to pick nearestRev. */
export function similarity(a: string, b: string): number {
  const lines = (s: string) => new Set(s.split('\n').map((l) => l.trim()).filter(Boolean))
  const [x, y] = [lines(a), lines(b)]
  if (x.size === 0 && y.size === 0) return 1
  let shared = 0
  for (const l of x) if (y.has(l)) shared++
  return shared / (x.size + y.size - shared)
}

/** `history` is every revision of the upstream file, newest first. */
export function classify(content: string | null, history: Revision[]): Classification {
  if (content === null) return { verdict: 'removed' }
  const newest = history[0]?.rev
  const exact = history.find((r) => r.hash === hash(content))
  if (exact) return { verdict: exact.rev === newest ? 'current' : 'stale', matchedRev: exact.rev }
  const nh = hash(normalize(content))
  const reformatted = history.find((r) => r.normalizedHash === nh)
  if (reformatted) {
    return { verdict: reformatted.rev === newest ? 'current' : 'stale', matchedRev: reformatted.rev, formattingOnly: true }
  }
  let nearest = history[0]
  let best = -1
  for (const r of history) {
    const s = similarity(content, r.content)
    if (s > best) [best, nearest] = [s, r]
  }
  return { verdict: 'divergent', nearestRev: nearest?.rev, similarity: Number(best.toFixed(3)) }
}

function git(args: string[], cwd: string): string | null {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  return r.status === 0 ? r.stdout : null
}

/** Every revision of `file` in `repo`, newest first, following renames. */
export function history(repo: string, file: string, stamp?: (s: string) => string): Revision[] {
  const log = git(['log', '--follow', '--format=%H %ad', '--date=short', '--name-only', '--', file], repo)
  if (log === null) throw new Error(`git log failed for ${file} in ${repo}`)
  const revs: Revision[] = []
  for (const entry of log.split(/\n(?=[0-9a-f]{40} )/)) {
    const [head, ...paths] = entry.trim().split('\n').filter(Boolean)
    if (!head) continue
    const [rev, date] = head.split(' ')
    const content = git(['show', `${rev}:${paths.at(-1) ?? file}`], repo)
    if (content !== null) revs.push(revision(rev, stamp ? stamp(content) : content, date))
  }
  return revs
}

function main() {
  const argv = process.argv.slice(2)
  const opt = (name: string) => {
    const i = argv.indexOf(name)
    if (i === -1) return undefined
    const [, value] = argv.splice(i, 2)
    return value
  }
  const upstream = opt('--upstream')
  const template = opt('--template')
  const stampRe = opt('--stamp')
  const stampAs = opt('--stamp-as') ?? ''
  if (!upstream || !template || argv.length === 0) {
    console.error('usage: bun ancestry.ts --upstream <repo> --template <path> [--stamp <regex> --stamp-as <text>] <consumer file>...')
    process.exit(2)
  }
  const stamp = stampRe ? (s: string) => s.replace(new RegExp(stampRe, 'm'), stampAs) : undefined
  const revs = history(upstream, template, stamp)
  if (revs.length === 0) console.error(`warning: ${template} has no history in ${upstream}; every file will be divergent`)

  for (const file of argv) {
    const raw = existsSync(file) ? readFileSync(file, 'utf8') : null
    const content = raw !== null && stamp ? stamp(raw) : raw
    const c = classify(content, revs)
    const added = existsSync(file)
      ? git(['log', '--diff-filter=A', '--follow', '--format=%ad', '--date=short', '--', basename(file)], dirname(file))
      : null
    console.log(
      JSON.stringify({
        file,
        ...c,
        matchedDate: revs.find((r) => r.rev === (c.matchedRev ?? c.nearestRev))?.date,
        upstreamNewest: revs[0]?.rev,
        upstreamFirstSeen: revs.at(-1)?.date,
        consumerFirstSeen: added?.trim().split('\n').at(-1) || undefined,
      }),
    )
  }
}

if (import.meta.main) main()
