# Solution — Settings dropdowns brought onto the standard treatment

**Date:** 2026-07-24
**Item:** #20
**Bug doc:** `2026-07-24-bug-inconsistent-dropdown-styling.md`

## The standard, restated

One dropdown look for the whole app:

| Part | Treatment |
|---|---|
| Trigger | `rounded-md`, `border-input`, `h-9`/`h-10`, `focus-visible:ring-2 ring-ring/20` |
| Popover surface | `rounded-xl`, `bg-popover`, `shadow-md`, `ring-1 ring-foreground/10` |
| Popover inner padding | **`p-1.5`** |
| Row | `rounded-md`, `focus:bg-accent` / `hover:bg-accent` |
| Selection | trailing check indicator |

Everything except inner padding was already true of `Select`. That one line is the whole fix.

## What changed

`className="p-1.5"` added to every settings-side `<SelectContent>` — 15 dropdowns across 8 files:

| File | Selects |
|---|---|
| `components/sprint/sprint-settings-form.tsx` | 4 — start day, default duration, name format, date format |
| `components/sprint/sprint-settings-modal.tsx` | 4 — same set in the modal |
| `components/workspace/members-manager.tsx` | 4 |
| `components/space/space-members-manager.tsx` | 3 |
| `components/workspace/invite-member-modal.tsx` | 1 |
| `components/workspace/invite-link-card.tsx` | 1 |
| `components/list/list-statuses-settings.tsx` | 1 |
| `app/(app)/[workspaceId]/notifications/settings/page.tsx` | 2 — delivery mode, digest time (the latter newly converted from a native `<input type="time">`) |
| `components/space/custom-fields-settings.tsx` | 1 — the Create/Edit Field **Type** select |

Triggers already passed `w-full` where the layout called for it; the custom-field Type trigger was the one exception and is fixed under #18.

## Why it works

With `p-1.5` on the content, the `rounded-md` rows are inset from the `rounded-xl` surface, so the hover fill renders as a distinct pill instead of a full-bleed band — visually identical to the `FacetFilter` popover the report compared against. Radius, shadow, ring, focus ring and check indicator were already correct, so nothing else needed touching.

## Cross-agent note — proposed shared change, NOT made

**The correct long-term fix is one line in `components/ui/select.tsx`:** add `p-1.5` to the `SelectPrimitive.Viewport` inside `SelectContent`, then delete all 15 per-call overrides above.

It was not done here because `SelectContent` is used by List and Board surfaces that Agents B and C are editing right now, and a padding change on the shared primitive shifts every dropdown in the app by 6px on all sides — the kind of diff that is miserable to review while three agents have the same files open.

**Proposal for B/C:** once the List (#B) and Board (#C) batches land, move `p-1.5` into `SelectContent` and strip the overrides. Consider two related sweeps at the same time, both flagged in the #18 solution doc:

- `components/ui/label.tsx` — drop the app-wide `uppercase tracking-wide`.
- `components/ui/dialog.tsx` — `rounded-lg` → `rounded-xl`.

No List or Board component was restyled by this change.
