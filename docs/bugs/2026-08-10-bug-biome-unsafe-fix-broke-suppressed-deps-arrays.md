# Bug: `biome check --write --unsafe` silently rewrote intentionally-suppressed hook dependency arrays

## Symptom

Two separate regressions surfaced from the same root cause:

1. **Crash** — `Maximum update depth exceeded` console error, reproducible on
   any List page. Stack trace: `useSetTopbar.useEffect (lib/topbar-context.tsx:48)`.
2. **Silent** — `BacklogView` (`components/sprint/backlog-view.tsx`) stopped
   refetching its data when the sprint page's external refresh signal fired
   (`refreshKey` prop change) or when a user-triggered internal refresh
   (`handleRefresh()`) occurred. No error, just stale data.

## Where

- `lib/topbar-context.tsx` — `useSetTopbar`
- `components/sprint/backlog-view.tsx` — `BacklogView`'s `fetchData` `useCallback`

## Root cause

Both hooks originally had a dependency array deliberately narrower or
differently-shaped than what naive static analysis would suggest, guarded by
an ESLint suppression comment:

```ts
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [key]);            // topbar-context.tsx — intentionally excludes `config`/`setState`
```
```ts
}, [workspaceId, spaceId, refreshKey, internalRefresh]); // eslint-disable-line react-hooks/exhaustive-deps
                                                            // backlog-view.tsx — refreshKey/internalRefresh
                                                            // aren't read in the body; they're only there
                                                            // to force a new callback identity
```

**Biome doesn't understand ESLint disable comments.** During an unrelated
repo-wide lint-debt cleanup, `pnpm exec biome check --write --unsafe .` was
run to auto-apply biome's own `lint/correctness/useExhaustiveDependencies`
"unsafe" fixes. Because the ESLint suppression is invisible to biome, it
applied its own (contradictory) fix to both hooks:

- `topbar-context.tsx`: biome saw `config`/`setState` used inside the effect
  but absent from the deps array, and *added* them — turning `[key]` into
  `[setState, config]`. Since `config` is a fresh object literal on every
  call (by design — the caller doesn't memoize it, `key`'s `JSON.stringify`
  is what's supposed to stabilize the effect), the effect now re-ran every
  render, calling `setState`, causing a parent re-render, a new `config`
  object, and the effect firing again — an infinite loop.
- `backlog-view.tsx`: biome saw `refreshKey`/`internalRefresh` in the deps
  array but *not* referenced inside the callback body, and considered them
  unnecessary — removing them. This broke the intentional "recreate the
  callback (and thus refetch) when this external signal changes" pattern.

Once the arrays were altered, the now-orphaned `key` variable (in
`topbar-context.tsx`) and `refreshKey`/`internalRefresh` (in
`backlog-view.tsx`, no longer referenced by the deps array) were
subsequently flagged by `lint/correctness/noUnusedVariables` /
`noUnusedFunctionParameters` in a later pass and renamed with a leading
underscore (`_key`, `_refreshKey`, `_internalRefresh`) — a lint fix that
was individually correct but masked the real problem instead of surfacing
it, since a prefixed-unused variable no longer triggers a warning.

Neither `tsc --noEmit` nor `biome check` catches this class of bug — both
passed cleanly throughout, since the resulting code is type-safe and
lint-clean, just behaviorally wrong (an infinite loop / a stale-data bug).
It was only caught via a runtime error report from the browser console.

See `2026-08-10-solution-biome-unsafe-fix-broke-suppressed-deps-arrays.md`.
