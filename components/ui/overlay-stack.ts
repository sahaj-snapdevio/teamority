import type * as React from "react"

export type OverlayLayer = {
  id: symbol
  containerRefs: Array<React.RefObject<HTMLElement | null>>
}

/**
 * Every currently-open dismissible overlay (Popover, DropdownMenu, Select,
 * Dialog, Sheet, AlertDialog), ordered oldest-first. Shared across overlay
 * types so nesting works correctly regardless of which components are
 * combined (a DropdownMenu opened from inside a Popover, a Popover inside a
 * Dialog, ...) even though portaled content ends up as a DOM *sibling*, not
 * a descendant, of its logical parent.
 */
export const overlayLayers: OverlayLayer[] = []

/** True if `node` is inside any currently-open overlay's registered containers. */
export function isWithinAnyOpenLayer(node: Node | null): boolean {
  if (!node) return false
  return overlayLayers.some((layer) =>
    layer.containerRefs.some((ref) => ref.current?.contains(node))
  )
}

/**
 * True while any dismissible overlay is open. Use this to suppress behaviour
 * that must not run "behind" an overlay — global keyboard shortcuts, and the
 * realtime auto-refresh (a refresh under an open overlay can close it or yank
 * the content the user is interacting with).
 *
 * Registration happens in `useDismiss`, which pushes only while `open` is true
 * and removes on cleanup, so this tracks open state exactly. Prefer it over
 * querying the DOM: `Select` keeps its content mounted (and `role="listbox"`)
 * while closed, so a `[role=...]`/`[data-slot=...]` probe reports a false
 * positive for every closed Select on the page. It also replaces the
 * `[data-radix-popper-content-wrapper]` checks that these call sites used
 * before the radix-ui migration — that wrapper no longer exists, and Popover
 * content sets no `role`, so those probes had stopped matching popovers.
 *
 * Tooltip is intentionally excluded: it does not use `useDismiss`, and a
 * hover-triggered tooltip should not block shortcuts or pause refresh.
 */
export function isOverlayOpen(): boolean {
  return overlayLayers.length > 0
}
