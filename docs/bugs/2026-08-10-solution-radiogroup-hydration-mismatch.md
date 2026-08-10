# Solution: RadioGroup SSR hydration mismatch

Fixes the defect described in
`2026-08-10-bug-radiogroup-hydration-mismatch.md`.

## Files touched

- `components/ui/radio-group.tsx`

## Change

Removed the module-level `radioGroupIdCounter` and its counter-based
fallback entirely, replacing it with `React.useId()`:

```ts
const generatedName = React.useId()
const groupName = name ?? generatedName
```

`useId()` is deterministic per component instance based on its position in
the render tree rather than shared mutable module state, so it is
guaranteed identical between the server render and the client's hydration
render, and unique per concurrently-mounted instance — solving both the
cross-request drift and the Strict Mode double-invocation problem with no
behavioral change.

Public API, controlled/uncontrolled value handling, native-radio-grouping
keyboard navigation, and CSS-only focus styling are all unchanged. All
three real consumers (`close-sprint-modal.tsx`, `list-view.tsx`,
`task-dependencies.tsx`) omit `name` today and needed no changes — they now
receive a `useId()`-derived name instead of a counter-derived one.
