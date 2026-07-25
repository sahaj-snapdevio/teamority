# Bug — Custom field delete dialog doesn't say how many tasks lose data

**Date:** 2026-07-24
**Item:** #13 (part 1 of the recommended split)

## Symptom

Deleting a custom field permanently destroys every stored value for it, but the confirmation dialog only says:

> This will permanently delete the field and remove all stored values from every task. This action cannot be undone.

"Every task" is unquantified. An admin about to delete a field has no way to tell — from the dialog — whether that means 0 tasks or 400. ClickUp, by comparison, states the blast radius outright ("will delete this Custom Field from **1 task**").

## Where

`components/space/custom-fields-settings.tsx` — the delete confirmation `Dialog` in `CustomFieldsSettings`.

## Root cause

The dialog is rendered purely from the `Field` row already in client state. That row has the definition (name, type, required, archived) but no usage information, and nothing ever counts `customFieldValue` rows for a definition — there was no action exposing that count. So the copy could only be written generically.

The destruction itself is real, not theoretical: `customFieldValue.fieldId` is declared `onDelete: "cascade"` (`db/schema/custom-field.ts`), so `deleteCustomFieldDefinition` removes every stored value along with the definition, with no recovery path.

## Scope note — this is deliberately *not* a trash/restore feature

The reporter also asked for an admin-restorable Trash. `CLAUDE.md` is explicit that Archive (reversible, keeps values) and Delete (permanent, cascades) are **intentionally separate, non-overlapping paths**. Adding soft-delete + Trash is a scope change to `docs/custom-fields.md`, not a bug fix, and needs product sign-off. Only the warning is fixed here. See the solution doc for the proposal.
