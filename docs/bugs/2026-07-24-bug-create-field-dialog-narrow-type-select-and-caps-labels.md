# Bug — Create Field dialog: narrow Type dropdown, ALL-CAPS labels

**Date:** 2026-07-24
**Items:** #18, and #19 (Archive menu item)

## Symptom

In Project Settings → Custom Fields → **Create Field**:

1. The **Type** select is sized to its content (roughly the width of "Single Select") while Name, Description, Placeholder, Options and the Min/Max inputs all span the dialog. It reads as a misaligned, half-finished form.
2. Every field label renders in capitals — "NAME", "DESCRIPTION", "PLACEHOLDER", "TYPE", "DEFAULT VALUE" — which is louder than the values and doesn't match the typography in `docs/design-system.md`.

In the custom-field row's **⋯** menu (#19):

3. **Edit** and **Delete** carry icons; **Archive** / **Unarchive** has none, so it sits text-only between two iconed rows.
4. Archive's label is `text-muted-foreground`, the same treatment the app uses for disabled text — the enabled action looks unavailable.

## Where

`components/space/custom-fields-settings.tsx` — `FieldFormDialog` (1, 2) and `FieldRow`'s actions `Popover` (3, 4).

## Root cause

1. **Narrow Type select:** `SelectTrigger` in `components/ui/select.tsx` defaults to `w-fit`. Every other caller in settings (e.g. `sprint-settings-form.tsx`) passes `className="w-full"`; this dialog didn't, so it inherited the shrink-to-fit default.

2. **ALL-CAPS labels:** not local to this dialog — the shared `Label` primitive (`components/ui/label.tsx`) hard-codes `text-xs font-semibold tracking-wide uppercase` for every label in the app. It already carries `peer-data-[slot=checkbox]:normal-case` escape hatches for checkbox/radio/switch labels, which is why "Required" reads normally while "NAME" shouts. Standalone form labels have no such escape.

3/4. **Archive menu item:** written without an icon, and given `text-muted-foreground` — presumably to distance it from the red destructive Delete. But muted is the app's disabled treatment, so it over-corrected into looking dead.
