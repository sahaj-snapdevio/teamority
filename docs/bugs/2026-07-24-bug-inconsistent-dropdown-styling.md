# Bug — Dropdowns look different across the app

**Date:** 2026-07-24
**Item:** #20

## Symptom

The Sprint settings "Schedule" pickers (Sprint starts on, Default duration) open as a flat bordered list whose rows run edge-to-edge against the popover boundary. The Assignee filter in List/Board opens a visibly different surface — inset rows with breathing room around them, a search box, and check indicators.

Side by side they don't read as the same control, even though both are "click a trigger, pick from a list".

## Where

- `components/sprint/sprint-settings-form.tsx`, `components/sprint/sprint-settings-modal.tsx` — the reported pair.
- Same defect in every other settings-side select: `components/space/space-members-manager.tsx`, `components/workspace/members-manager.tsx`, `components/workspace/invite-member-modal.tsx`, `components/workspace/invite-link-card.tsx`, `components/list/list-statuses-settings.tsx`, `app/(app)/[workspaceId]/notifications/settings/page.tsx`.
- Reference implementation (correct): `components/filters/facet-filter.tsx`.

## Root cause

It is not a radius or ring problem — those already agree. `SelectTrigger` is `rounded-md` with a `focus-visible:ring-2` ring, `SelectContent` is `rounded-xl` with the same shadow and ring as `PopoverContent`, and `SelectItem` already renders a `CheckIcon` indicator.

The difference is **inner padding**:

- `PopoverContent` (`components/ui/popover.tsx`) applies `p-1` to itself, and `FacetFilter` bumps it to `p-1.5`. Its `rounded-md` rows therefore float inside the popover with a margin, and their hover fill reads as a discrete highlighted row.
- `SelectContent` (`components/ui/select.tsx`) applies **no padding** to its viewport. (`SelectGroup` carries `p-1.5`, but only callers that wrap items in a `SelectGroup` get it — none of the settings selects do.) So `SelectItem`s sit flush against the popover edges, their `rounded-md` corners are clipped visually by the container, and the hover fill bleeds to the border. That is what makes it look like a "plain bordered list".

Every ungrouped `Select` in the app has this, which is why the mismatch shows up wherever a settings dropdown sits next to a filter dropdown.
