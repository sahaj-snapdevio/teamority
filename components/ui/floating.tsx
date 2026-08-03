"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
  autoUpdate,
  computePosition,
  flip,
  offset as offsetMiddleware,
  shift,
  size as sizeMiddleware,
  type Placement,
} from "@floating-ui/dom"

import { createPreventableEvent, type PreventableEvent } from "@/components/ui/overlay"
import { overlayLayers } from "@/components/ui/overlay-stack"

/**
 * Renders children into document.body via a React portal, once mounted on
 * the client. Replaces radix-ui's `*.Portal` primitives.
 */
function Portal({
  children,
  container,
}: {
  children?: React.ReactNode
  container?: Element | null
}) {
  const [mounted, setMounted] = React.useState(false)
  // useLayoutEffect (not useEffect): flips before the browser paints, so
  // the very first frame the user sees already has the portaled content —
  // useEffect would let the browser paint one frame of "nothing" first,
  // visible as a blink on every open.
  React.useLayoutEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, container ?? document.body)
}

type UseFloatingPositionOptions = {
  open: boolean
  placement?: Placement
  gap?: number
  boundaryPadding?: number
  /** Match the floating element's width to the reference element's width. */
  matchReferenceWidth?: boolean
}

/**
 * Computes fixed-position coordinates for a floating element relative to a
 * reference element using @floating-ui/dom — collision-aware (flips to the
 * opposite side and shifts along the axis to stay within the viewport) and
 * kept in sync while open via autoUpdate (scroll/resize/layout changes).
 * Replaces radix-ui's Popper-based positioning used by Popover/Select/
 * DropdownMenu/Tooltip content.
 */
function useFloatingPosition({
  open,
  placement: preferredPlacement = "bottom-start",
  gap = 4,
  boundaryPadding = 8,
  matchReferenceWidth = false,
}: UseFloatingPositionOptions) {
  const referenceRef = React.useRef<HTMLElement | null>(null)
  const floatingNodeRef = React.useRef<HTMLElement | null>(null)
  // Last node we actually bumped `floatingVersion` for — distinct from
  // `floatingNodeRef` because consumers pass an inline ref callback, whose
  // identity changes every render. React reacts to that by calling the old
  // ref with `null` then the new ref with the node on EVERY render, even
  // when the underlying DOM element hasn't changed. Comparing against this
  // "last notified" value (rather than bumping on every non-equal write,
  // including the transient nulls) avoids reacting to that churn — which
  // would otherwise re-render -> re-churn -> re-render forever.
  const lastNotifiedNodeRef = React.useRef<HTMLElement | null>(null)
  const [floatingVersion, setFloatingVersion] = React.useState(0)
  // A getter/setter ref object (stable identity) instead of a plain useRef:
  // Portal mounts its child a tick after `open` flips true, so the real
  // floating node isn't attached on the same render as the positioning
  // effect below. Bumping state when the node attaches re-triggers that
  // effect; a plain ref's mutation wouldn't cause a re-render at all.
  const floatingRef = React.useMemo<React.RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        return floatingNodeRef.current
      },
      set current(node: HTMLElement | null) {
        floatingNodeRef.current = node
        if (node && node !== lastNotifiedNodeRef.current) {
          lastNotifiedNodeRef.current = node
          setFloatingVersion((v) => v + 1)
        }
      },
    }),
    []
  )
  const [styles, setStyles] = React.useState<React.CSSProperties>({
    position: "fixed",
    top: 0,
    left: 0,
    transitionProperty: "none",
    animationFillMode: "forwards",
  })
  const [placement, setPlacement] = React.useState<Placement>(
    preferredPlacement
  )
  const [hasPositioned, setHasPositioned] = React.useState(false)

  const update = React.useCallback(() => {
    const reference = referenceRef.current
    const floating = floatingRef.current
    if (!reference || !floating) return

    const middleware = [
      offsetMiddleware(gap),
      flip({ padding: boundaryPadding }),
      shift({ padding: boundaryPadding }),
      sizeMiddleware({
        padding: boundaryPadding,
        apply({ availableHeight, rects, elements }) {
          Object.assign(elements.floating.style, {
            maxHeight: `${Math.max(availableHeight, 128)}px`,
            ...(matchReferenceWidth
              ? { width: `${rects.reference.width}px` }
              : {}),
          })
        },
      }),
    ]

    computePosition(reference, floating, {
      placement: preferredPlacement,
      middleware,
    }).then(({ x, y, placement: finalPlacement }) => {
      // Position via top/left, not `transform` — the entrance/exit
      // animation classes (animate-in zoom-in-95, slide-in-from-*, ...)
      // also animate `transform` for their scale/slide effect. Sharing the
      // property meant the animation's transform won for its ~100ms
      // duration, so the element rendered un-translated (viewport corner)
      // until the animation finished and this transform reasserted itself.
      //
      // transitionProperty:none because a global `transition: all` applies
      // here — without this the browser TRANSITIONS top/left from the
      // fallback 0,0 to the real coordinates, visibly sliding the panel in
      // from the viewport's top-left corner on first open. The entrance
      // zoom/fade is a CSS *animation* (animation-name: enter), so it is
      // unaffected by suppressing transitions.
      // animationFillMode:forwards so the exit animation HOLDS its end state
      // (opacity 0) until usePresence unmounts the node. The animation runs
      // 100ms but the unmount is at 150ms, and the default fill-mode of `none`
      // reverts the element to its normal fully-opaque styles the moment the
      // animation ends — a ~50ms flash of the fully-visible panel just before
      // it disappears, which reads as the menu re-opening as you close it.
      setStyles({
        position: "fixed",
        top: Math.round(y),
        left: Math.round(x),
        transitionProperty: "none",
        animationFillMode: "forwards",
      })
      setPlacement(finalPlacement)
      setHasPositioned(true)
    })
  }, [preferredPlacement, gap, boundaryPadding, matchReferenceWidth])

  // useLayoutEffect + an eager `update()` call: `autoUpdate` only reacts to
  // subsequent resize/scroll/layout changes, it doesn't compute a position
  // itself on registration (that arrives via its internal ResizeObserver's
  // first callback, which fires on a later tick). Waiting for that adds a
  // visible delay between mount and the first real position. Calling
  // `update()` immediately computes it up front; `autoUpdate` then just
  // keeps it in sync afterward.
  React.useLayoutEffect(() => {
    const reference = referenceRef.current
    const floating = floatingRef.current
    if (!open || !reference || !floating) return
    update()
    return autoUpdate(reference, floating, update)
  }, [open, update, floatingVersion])

  // Until the first `computePosition` resolves, `styles` is still the
  // fallback `{top:0, left:0}` — painting that would flash the floating
  // element in the viewport's corner before it jumps to its real spot.
  // Stay hidden until a real position has been computed.
  return {
    referenceRef,
    floatingRef,
    styles: hasPositioned ? styles : { ...styles, visibility: "hidden" as const },
    placement,
    update,
  }
}

/**
 * Closes an open floating element on outside pointerdown or Escape.
 * `containerRefs` should include every element the click/keydown should be
 * treated as "inside" (e.g. both the trigger and the floating content).
 *
 * Two stacking rules, both needed because nested overlays (a DropdownMenu
 * opened from inside a Popover, a date-picker Popover inside a filter
 * Popover, ...) are portaled to document.body as DOM *siblings*, not
 * descendants, of their logical parent:
 *  - Escape only dismisses the topmost open layer.
 *  - An outside-pointerdown only closes a layer if the click is not inside
 *    ANY layer opened after it either — otherwise interacting with a nested
 *    child overlay would incorrectly close its ancestor.
 *
 * `onEscapeKeyDown`/`onPointerDownOutside` mirror radix-ui's escape-hatch
 * callbacks — call `event.preventDefault()` in either to suppress the close
 * (e.g. to block dismissal while an async action is in flight).
 */
function useDismiss({
  open,
  onOpenChange,
  containerRefs,
  closeOnOutsidePointerDown = true,
  onEscapeKeyDown,
  onPointerDownOutside,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  containerRefs: Array<React.RefObject<HTMLElement | null>>
  closeOnOutsidePointerDown?: boolean
  onEscapeKeyDown?: (event: PreventableEvent) => void
  onPointerDownOutside?: (event: PreventableEvent) => void
}) {
  const onOpenChangeRef = React.useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange
  const onEscapeKeyDownRef = React.useRef(onEscapeKeyDown)
  onEscapeKeyDownRef.current = onEscapeKeyDown
  const onPointerDownOutsideRef = React.useRef(onPointerDownOutside)
  onPointerDownOutsideRef.current = onPointerDownOutside

  React.useEffect(() => {
    if (!open) return
    const id = Symbol("dismiss-layer")
    overlayLayers.push({ id, containerRefs })

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      const insideOwn = containerRefs.some((ref) => ref.current?.contains(target))
      if (insideOwn) return

      const myIndex = overlayLayers.findIndex((layer) => layer.id === id)
      const insideNestedLayer = overlayLayers
        .slice(myIndex + 1)
        .some((layer) =>
          layer.containerRefs.some((ref) => ref.current?.contains(target))
        )
      if (insideNestedLayer) return

      const preventable = createPreventableEvent()
      onPointerDownOutsideRef.current?.(preventable)
      if (preventable.defaultPrevented) return
      if (closeOnOutsidePointerDown) onOpenChangeRef.current(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      if (overlayLayers[overlayLayers.length - 1]?.id !== id) return

      const preventable = createPreventableEvent()
      onEscapeKeyDownRef.current?.(preventable)
      if (preventable.defaultPrevented) return
      onOpenChangeRef.current(false)
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
      document.removeEventListener("keydown", handleKeyDown, true)
      const index = overlayLayers.findIndex((layer) => layer.id === id)
      if (index !== -1) overlayLayers.splice(index, 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, containerRefs, closeOnOutsidePointerDown])
}

/**
 * Keeps a floating element mounted for `exitDurationMs` after `open` becomes
 * false, so exit animations (data-closed:animate-out, etc.) can play instead
 * of the element disappearing instantly. Mirrors radix-ui's Presence.
 */
function usePresence(open: boolean, exitDurationMs = 150) {
  const [mounted, setMounted] = React.useState(open)

  // useLayoutEffect for the entry path (mounted flips before paint, so
  // there's no visible gap between click and the content appearing); the
  // exit path's setTimeout is unaffected either way since it's scheduled
  // for later regardless of effect type.
  React.useLayoutEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    if (!mounted) return
    const timeout = setTimeout(() => setMounted(false), exitDurationMs)
    return () => clearTimeout(timeout)
  }, [open, mounted, exitDurationMs])

  return mounted
}

export { Portal, useFloatingPosition, useDismiss, usePresence }
