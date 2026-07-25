# Solution — Delete dialog states the affected task count

**Date:** 2026-07-24
**Item:** #13 (part 1)
**Bug doc:** `2026-07-24-bug-custom-field-delete-hides-blast-radius.md`

## What changed

### `app/actions/custom-field.ts` — new read action

```ts
export async function getCustomFieldValueCount(
  workspaceId: string,
  fieldId: string
): Promise<{ count: number } | { error: string }>
```

Counts `customFieldValue` rows for the definition — exactly the set `deleteCustomFieldDefinition` would cascade away. It resolves the field's `spaceId` first and runs the same `requireFieldAdmin()` check the delete path uses, so it can't be used to probe fields the caller may not administer. Placed immediately above `deleteCustomFieldDefinition` so the pairing is obvious. Read-only — no `refreshWorkspace` call.

### `components/space/custom-fields-settings.tsx`

- New `deleteUsage: number | null` state, loaded by an effect that fires whenever `deleteTarget` becomes non-null. The effect has a `cancelled` guard so a fast open→close→open doesn't write a stale count.
- The dialog body now reads, by case:
  - **count loading or errored** (`null`) — the original generic wording,
  - **0** — "This will permanently delete the field. No task has a value for it yet.",
  - **N** — "This will permanently delete the field and its values from **N task(s)**." with the count emphasised.
- All three cases close with: "This action cannot be undone — archive the field instead to hide it while keeping its values." That points at the reversible path from the moment of maximum regret.

Unchanged: the standard shadcn confirm `Dialog` (never `window.confirm`), centred `TrashIcon` in a red circle, Cancel + destructive Delete side by side, and the delete behaviour itself.

## Why it works

The count comes from the same table and the same `fieldId` the FK cascade acts on, so it is the true blast radius rather than an estimate. Failure is safe by construction: if the action errors, `deleteUsage` stays `null` and the dialog shows the old, still-accurate generic warning — it never renders a misleadingly low number.

## Not built — raised as a product decision (#13 part 2)

**Proposal:** soft-delete + admin-restorable Trash for custom fields.

- **Conflict:** `CLAUDE.md` and `docs/custom-fields.md` currently define Archive and Delete as separate, non-overlapping paths, with Delete permanent by design. Trash collapses that distinction — Archive would become "hide, still usable" and Trash "hidden and unusable, restorable", which is a real product model change, not a bug fix.
- **Cost:** `isDeleted` / `deletedAt` columns + migration, dropping the `onDelete: "cascade"` reliance so values survive until purge, a retention/purge job, a Trash UI honouring `requireFieldAdmin()`, and a rewrite of the Archive-vs-Delete section of `docs/custom-fields.md`.
- **Recommendation:** ship the count warning (done) and hold Trash until product confirms it wants the three-state model. If the goal is only "don't lose data by accident", Archive already delivers that and the new dialog copy now points users to it.
