# Solution — Full-width Type select, sentence-case labels, iconed Archive

**Date:** 2026-07-24
**Items:** #18, #19
**Bug doc:** `2026-07-24-bug-create-field-dialog-narrow-type-select-and-caps-labels.md`

All changes are in `components/space/custom-fields-settings.tsx`.

## #18 — Type select width

`<SelectTrigger>` → `<SelectTrigger className="w-full">`, with a comment recording *why* (the primitive defaults to `w-fit`) so it doesn't get "cleaned up" later. The Type select now matches every other control in the dialog.

**Not regressed:** the select keeps `disabled={busy || isEdit}` and the "Type can't be changed after creation." hint in Edit mode. A field's type is still immutable after creation.

## #18 — Sentence-case labels

The all-caps treatment comes from the shared `Label` primitive, which is used app-wide, so it was **not** modified (see the cross-agent note below). Instead the dialog opts out locally through one constant:

```ts
// The shared <Label> primitive is ALL CAPS app-wide; the field form opts out so
// its labels read as sentence case ("Name", not "NAME") per docs/design-system.md.
const FIELD_LABEL_CLASS = "text-xs font-medium normal-case tracking-normal";
```

Applied to the ten standalone labels in `FieldFormDialog` (Name, Description, Placeholder, Type, Options, Min, Max, and the three Default value variants). `text-xs font-medium` is the "Small Bold / Labels" row of the typography table in `docs/design-system.md`; `normal-case tracking-normal` cancels the primitive's `uppercase tracking-wide`.

The checkbox labels ("Required", "Default: Checked") were already sentence case — the primitive's `peer-data-[slot=checkbox]` rules handle those — so they're untouched and now match the rest.

## #18 — Dialog radius

Both dialogs in the file (`FieldFormDialog` and the delete confirmation) now pass `rounded-xl`, since the shared `DialogContent` still hard-codes `rounded-lg`. Local override, same reason as the labels.

## #19 — Archive menu item

- Added an icon: `ArchiveIcon` when archiving, `ArrowCounterClockwiseIcon` when unarchiving — `size-3.5`, matching Edit's `PencilSimpleIcon` and Delete's `TrashIcon`.
- Dropped `text-muted-foreground` so the row inherits normal foreground text, identical to Edit. Delete keeps `text-destructive` + `hover:bg-destructive/10`, so the menu now reads as two neutral actions and one destructive one — which is the actual semantics.

## Cross-agent note — shared `components/ui` changes NOT made

Two shared primitives are the real root cause. Both were left alone because they affect every surface in the app, including the ones Agents B and C are actively editing:

1. **`components/ui/label.tsx`** — the app-wide `uppercase tracking-wide` on `Label`. Every form label in Kanbanica is currently ALL CAPS. If sentence case is the intended design-system default, the fix is to drop `uppercase tracking-wide` from the primitive and delete the per-call overrides (including `FIELD_LABEL_CLASS` above). **Proposed, not done.**
2. **`components/ui/dialog.tsx`** — `DialogContent` uses `rounded-lg`, but `CLAUDE.md` requires `rounded-xl` on all dialogs. Every dialog in the app is currently one step under-rounded. The fix is a one-word change in the primitive. **Proposed, not done.**

Both are single-line changes with wide visual blast radius — worth doing once B and C have landed, as a single sweep rather than three agents overriding locally.
