# Bug: RadioGroup SSR hydration mismatch

## Symptom

Any `RadioGroup` instance mounted without an explicit `name` prop could
trigger a React hydration-mismatch warning ("Text content does not match
server-rendered HTML" / an attribute mismatch on the underlying `name="..."`
of the radio `<input>` elements) — worse in development under React Strict
Mode, but latent in production too since the server- and client-computed
fallback names could diverge on any request.

## Where

`components/ui/radio-group.tsx` — `RadioGroup`'s fallback `name` generation.
Flagged during the daisyUI migration follow-up audit
(`docs/internal/2026-08-07-daisyui-migration-report.md`) as a pre-existing,
out-of-scope bug found in Phase 0.

## Root cause

```ts
let radioGroupIdCounter = 0
// ...
const groupName = React.useState(
  () => name ?? `radio-group-${++radioGroupIdCounter}`
)[0]
```

`radioGroupIdCounter` was a module-level, process-lifetime mutable counter,
incremented as a side effect of a `useState` lazy initializer whenever no
explicit `name` was passed. Two independent things made the server- and
client-computed value diverge:

- **Cross-request drift.** The server process reuses the same loaded module
  (and thus the same counter) for every request it serves, so the counter
  keeps climbing across unrelated requests/users for the life of the
  process. Every fresh client page load, by contrast, starts a brand-new JS
  heap and restarts the counter at 0. Any server process that had already
  served more than one `RadioGroup`-containing request before the request
  being hydrated would emit a `name` the client could never reproduce.
- **Strict Mode double-invocation.** The App Router runs with React Strict
  Mode by default (unset in `next.config.mjs`, which defaults it on).
  Client-side, Strict Mode double-invokes render functions in development to
  surface impure side effects — and `++radioGroupIdCounter` inside the lazy
  initializer is exactly such an impurity, so the client could burn an extra
  increment per mount that never happened server-side, widening the gap
  further in dev.

None of the three real consumers (`components/sprint/close-sprint-modal.tsx`,
`app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/list-view.tsx`,
`components/task/task-dependencies.tsx`) pass an explicit `name`, so all
three relied on this buggy fallback. `React.useId()` — the mechanism
designed specifically to produce a value stable across the server render and
the client hydration render — was not used anywhere in the file.

See `2026-08-10-solution-radiogroup-hydration-mismatch.md`.
