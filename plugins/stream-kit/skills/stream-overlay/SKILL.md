---
name: stream-overlay
description: Restart and verify the project's stream overlay — the HUD served on a fixed port that OBS captures. Use when going live (driven by stream-start), when the overlay is stale or blank mid-stream, or when the user asks to restart or check the overlay.
---

# Stream overlay

Restarts the local HUD server that OBS captures as a browser source, and proves
it came back up.

**Read the config first** — its Overlay section either names an absolute path,
a port, a start command and a health check, or it says `None`. Nothing in this
skill is hardcoded to a project.

Config lives in **one of two places**. Check in this order and use the first
that exists:

1. **`docs/agents/stream.md`** in this repo — the *committed* layout, for a repo
   you own alone or share only with people who are in on the stream.
2. **`~/.claude/stream/<repo-dir-name>/stream.md`** — the *personal* layout, for
   a repo shared with other contributors. `<repo-dir-name>` is the basename of
   the repo root, so `~/Projects/jaequery/fredrin` → `~/.claude/stream/fredrin/`.

The bank — `stream-titles.md` — always sits **beside** whichever config you
found. Never mix the two layouts.

Below, **the config** means that `stream.md` and **the bank** means that
`stream-titles.md`.

**If that section says `None` — or is absent — this project has no overlay.**
Say so and stop.

Do not go looking for one, and never start a server you found by guessing. An
overlay in a *different* repo reads that repo's board: pointed at this project it
would put another project's tickets on camera, which looks like a working overlay
and is worse than none.

## The clock

Booting the overlay **zeroes anything it counts from process start** — typically
the on-air clock and the session's completed count. So:

- **Restart it as late as possible, immediately before Go Live.** Restarting
  after the stream has begun throws away the session's numbers on camera.
- Restarting mid-stream is a real cost, not a free retry. Say so before doing it
  and let the user decide.

## Restart

Run from a terminal that already has the project's environment — a Fredrin
terminal for a Fredrin-backed board, since the overlay reads the board through
the same token file. A process spawned without it starts with no data and looks
identical to a healthy one for the first few seconds.

```bash
# 1. Is one already up? Confirm what it is before killing anything.
lsof -nP -iTCP:<port> -sTCP:LISTEN
ps -o command= -p <pid>          # must match the configured start command

# 2. Stop it, then start fresh, detached
kill <pid>
nohup <start command> > /tmp/overlay.log 2>&1 &
```

Never `kill` a PID whose `ps` line you have not read. The port is a convention,
not a guarantee.

Nothing listening is the normal first-run state — skip straight to the start.

## Verify

**Both must pass before you say it is up.** A skill that reports success on a
half-dead overlay is worse than one that reports nothing, because the failure
surfaces on camera instead of in the terminal.

```bash
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:<port>/?snapshot"   # 200
curl -s "http://127.0.0.1:<port>/?snapshot" | head -c 400                      # real board data
```

Use the snapshot endpoint for any check. The normal URL holds an SSE connection
open and never settles, so a plain `curl` against it hangs rather than answering.

Then read `/tmp/overlay.log`.

**Judge the log, do not grep it for one word.** A server that boots without
credentials commonly logs the fact and keeps running in a degraded mode — it
serves 200s, renders the frame, and shows nothing live. So:

- A line naming a **missing key, no token, or polling-only** is a FAILURE to
  report, even though the process is up and the port answers.
- The snapshot body deciding it is healthy is the board data in it, not the
  status code.

Report degraded as degraded. The user can choose to go live with a static HUD;
they cannot choose that if you told them it was fine.

## Hand back

One line: up on the port, what the boot reset, and anything degraded.

Then the OBS note: the browser source reconnects on its own **only** if
*Shutdown source when not visible* is unchecked. Otherwise it needs
right-click → Refresh, and it will show the pre-restart frame until it gets one.
