# Scaffold and verification harness

Copy-paste setup and the two verification loops. Nothing here is optional: the
drive script gates the UI phase, and the browser driver gates the report.

---

## 1. Project scaffold

Vite + React + TypeScript + XState. No CSS framework — a hand-written tokens
file makes the design system legible as an artifact and removes build-tool risk.

```bash
NAME=whatever-proto
mkdir -p "$NAME"/{src/{machines,data,pages,components,styles},scripts}
cd "$NAME"

cat > package.json <<'EOF'
{
  "name": "PROTO_NAME",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": { "dev": "vite", "typecheck": "tsc --noEmit" },
  "dependencies": {
    "react": "^18.3.1", "react-dom": "^18.3.1",
    "xstate": "^5.19.0", "@xstate/react": "^4.1.3"
  },
  "devDependencies": {
    "@types/react": "^18.3.12", "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4", "typescript": "^5.7.2", "vite": "^6.0.5"
  }
}
EOF
sed -i '' "s/PROTO_NAME/$NAME/" package.json

cat > vite.config.ts <<'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], server: { port: 5273, strictPort: true } });
EOF

cat > index.html <<'EOF'
<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Prototype</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
EOF

bun install
```

`tsconfig.json` — strict, with `noUnusedLocals` and `noUnusedParameters` on. They
catch dead machine wiring early.

Give each prototype its own port if several will run at once (5273, 5274, …).

### Hash router

Three routes with no router dependency. Scope the nav's own class names so they
cannot collide with the design system (`.navtab`, not `.tab` — that collision
has happened).

```tsx
const PAGES = {
  designed: { label: 'Designed', component: DesignedPage },
  bare: { label: 'Bare', component: BarePage },
  states: { label: 'States', component: StatesPage },
} as const;
```

Optionally support `?open=<key>` to deep-link into a detail view. It costs six
lines and makes detail panes screenshottable headlessly.

---

## 2. The headless drive script

`scripts/drive.ts`, run with `bun scripts/drive.ts`. Write it **before** any
component and do not proceed until it passes.

```ts
import { createActor } from 'xstate';

let failures = 0;
const ok = (label: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? `  — ${extra}` : ''}`);
  if (!cond) failures++;
};
const section = (t: string) => console.log(`\n${t}`);

const waitFor = (a: { subscribe: Function }, pred: () => boolean, label: string, ms = 15000) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout: ${label}`)), ms);
    const check = () => { if (pred()) { clearTimeout(t); sub.unsubscribe(); resolve(); } };
    const sub = a.subscribe(check);
    check();
  });

const path = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    const k = Object.keys(v as object)[0];
    const tail = path((v as Record<string, unknown>)[k]);
    return tail ? `${k}.${tail}` : k;
  }
  return '';
};

/* ... assertions ... */

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
```

### What to assert

Prioritise things a screenshot cannot show and a component test would miss.

```ts
// 1. Refusals — the real test that guards work.
ok('START is not accepted in review', !actor.getSnapshot().can({ type: 'START' }));

// 2. Independence of parallel regions.
actor.send({ type: 'ARCHIVE' });
ok('archive does NOT mark read', isUnread(actor.getSnapshot().value), 'the flat-enum bug');

// 3. That a window actually expires.
await settle(5200);
ok('UNDO is no longer accepted', !actor.getSnapshot().can({ type: 'UNDO' }));

// 4. Seeded failure recovers.
ok('seeded merge failure', path(v) === 'mergeFailed', ctx.error ?? '');
actor.send({ type: 'RETRY' });
ok('retry recovers', path(v) === 'completed');

// 5. Final states accept nothing.
ok('nothing is accepted afterwards', !actor.getSnapshot().can({ type: 'RESTORE' }));

// 6. Parent/child wiring.
ok('cancelling prunes it from the parent', ctx.children.length === before);
```

Pass a short `extra` string on the interesting ones — it makes the run output
readable as a description of the model.

**Expect failures here, and prefer them.** A failing assertion at this stage is
the cheapest bug you will find. When one fires, decide honestly whether the
machine or the assertion is wrong; both happen.

---

## 3. Screenshot every page, then look

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for p in designed bare states; do
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --window-size=1600,1100 --screenshot="shot-$p.png" \
    --virtual-time-budget=5000 "http://localhost:5273/#/$p"
done
```

Then actually read the images. Things only screenshots catch: overlapping
layers, wrapped metadata rows, z-index (a highlight layer painting over text),
class-name collisions between the prototype nav and the design system, and
avatars all rendering as the wrong person.

`--virtual-time-budget` also advances timers, so a state with a 5s auto-dismiss
may have moved on by the time the frame is captured. If a card looks wrong,
check whether it simply expired.

---

## 4. Drive the real interactions over CDP

Screenshots cannot click. Launch Chrome with a debugging port and script it.

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
("$CHROME" --headless --disable-gpu --remote-debugging-port=9222 \
   --window-size=1500,1000 --hide-scrollbars about:blank >/dev/null 2>&1 &)
sleep 3
bun cdp.ts
```

```ts
// cdp.ts
const t = (await (await fetch('http://localhost:9222/json/list')).json())
  .find((x: any) => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0;
const pending = new Map<number, (v: any) => void>();
const errs: string[] = [];

ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data as string);
  if (m.id && pending.has(m.id)) { pending.get(m.id)!(m.result); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown')
    errs.push((m.params.exceptionDetails.exception?.description ?? 'exception').split('\n')[0]);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
    errs.push('console.error: ' + m.params.args.map((a: any) => a.value ?? a.description).join(' '));
});

await new Promise((r) => ws.addEventListener('open', r));
const send = (method: string, params: any = {}) =>
  new Promise<any>((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const js = async (e: string) =>
  (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const shot = async (n: string) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  await Bun.write(`${n}.png`, Buffer.from(r.data, 'base64'));
};

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: 'http://localhost:5273/#/designed' });
await wait(2000);

// ...interactions...

console.log('errors:', errs.length ? errs.slice(0, 5) : 'none');
process.exit(0);
```

### Setting a controlled input from CDP

React ignores a plain `.value =` assignment. Use the native setter and dispatch:

```ts
const setVal = (sel: string, v: string) => `(() => {
  const el = document.querySelector('${sel}');
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  const s = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set;
  s.call(el, ${JSON.stringify(v)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
})()`;
```

### Reading state back

Print a machine-state line into the page (a footer with `mode: … · sync: …` is
enough) and read it. That turns the driver's output into evidence you can paste
into the report:

```
1 initial   : All changes saved in Drive | mode: editing · sync: clean
2 typed     : Unsaved changes            | sync: dirty
3 autosaved : All changes saved in Drive | sync: clean
5 view mode : body length 41 -> 41 (unchanged)
```

Always print `errs` at the end. A silent React error is otherwise invisible in a
headless run.

Clean up the driver script and throwaway screenshots when done.

---

## 5. Before reporting

```bash
./node_modules/.bin/tsc --noEmit    # must be clean
bun scripts/drive.ts                # must pass
```

`tsc` is the real check for dangling imports after any deletion or refactor.
