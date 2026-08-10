# Solution: restore intentional dependency arrays, suppress with `biome-ignore` instead of `eslint-disable`

## What changed

**`lib/topbar-context.tsx`** — `useSetTopbar`: restored the dependency array
to `[key]` (renamed `_key` back to `key` since it's referenced again), and
replaced the `eslint-disable-next-line` comment with a `biome-ignore`
comment biome actually understands, placed directly above the
`React.useEffect(` line (biome requires the ignore comment immediately
above the flagged statement, not inside its body):

```ts
// biome-ignore lint/correctness/useExhaustiveDependencies: config/setState intentionally excluded — config is a fresh object every render, `key` is the stable stand-in used to detect real changes (title/breadcrumbs), and setState is stable from context.
React.useEffect(() => {
  setState(config);
  return () => setState(null);
}, [key]);
```

**`components/sprint/backlog-view.tsx`** — `BacklogView`: restored
`refreshKey`/`internalRefresh` (renamed back from `_refreshKey`/
`_internalRefresh`) to the `fetchData` `useCallback`'s dependency array, and
replaced the `eslint-disable-line` comment with a `biome-ignore` above the
`const fetchData = React.useCallback(` line:

```ts
// biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey/internalRefresh aren't read in the body — they're included purely to force a new fetchData identity (and thus a refetch) when an external refresh signal fires.
const fetchData = React.useCallback(async () => {
  ...
}, [workspaceId, spaceId, refreshKey, internalRefresh]);
```

## Why it works

`biome-ignore` comments are biome's native suppression mechanism — unlike
`eslint-disable`, biome actually honors them, so it will no longer try to
"correct" either dependency array on a future `--write --unsafe` run.
Restoring the original arrays fixes both symptoms: `useSetTopbar`'s effect
only re-fires when the stringified `key` (title/breadcrumbs) actually
changes, not on every render, eliminating the infinite loop; `fetchData` in
`BacklogView` gets a new identity (triggering a refetch via its own
`useEffect(() => { void fetchData() }, [fetchData])`) whenever `refreshKey`
or `internalRefresh` changes, restoring the refresh-on-signal behavior.

## Root-cause prevention

Repo-wide, any hook dependency array that was previously guarded with an
`eslint-disable` comment is invisible to biome and at risk of being silently
"corrected" by `biome check --write --unsafe`. All occurrences of this
pattern were audited (`grep -rln "eslint-disable.*exhaustive-deps"`) after
this bug was found; the two above were the only ones with an actual
behavioral diff from the pre-cleanup committed code — the rest already had
biome-compatible dependency arrays and were unaffected.

## Files touched

- `lib/topbar-context.tsx`
- `components/sprint/backlog-view.tsx`
