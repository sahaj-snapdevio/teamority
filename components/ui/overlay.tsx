"use client"

import * as React from "react"

import { isWithinAnyOpenLayer } from "@/components/ui/overlay-stack"

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getFocusable(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter((el) => el.offsetParent !== null || el === document.activeElement)
}

const trapStack: symbol[] = []

/**
 * Full keyboard focus trap for true modal overlays (Dialog/AlertDialog/Sheet):
 * moves focus into the container on open, cycles Tab/Shift+Tab within it, and
 * restores focus to whatever was focused before on close. When multiple traps
 * are active (nested dialogs), only the topmost one responds — inner traps
 * shadow outer ones instead of fighting over focus. Replaces radix-ui's
 * FocusScope.
 */
function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean
) {
  const idRef = React.useRef<symbol | null>(null)
  const previouslyFocusedRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const id = Symbol("focus-trap")
    idRef.current = id
    trapStack.push(id)
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null

    const focusables = getFocusable(container)
    if (focusables.length > 0) {
      focusables[0].focus()
    } else {
      container.focus()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return
      if (trapStack[trapStack.length - 1] !== id) return

      const items = getFocusable(container as HTMLElement)
      if (items.length === 0) {
        event.preventDefault()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement

      // Focus that has moved into a nested overlay (a Popover/DropdownMenu
      // opened from within this dialog) isn't actually "escaped" — it's
      // portaled to a DOM sibling rather than a descendant, so
      // container.contains() alone can't see it.
      const hasEscaped =
        !container!.contains(current) && !isWithinAnyOpenLayer(current)

      if (event.shiftKey) {
        if (current === first || hasEscaped) {
          event.preventDefault()
          last.focus()
        }
      } else if (current === last || hasEscaped) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown, true)

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true)
      const index = trapStack.indexOf(id)
      if (index !== -1) trapStack.splice(index, 1)

      // Don't steal focus back if something else (e.g. a confirmation dialog
      // opened as a side effect of this one closing) has already claimed it.
      const active = document.activeElement as HTMLElement | null
      const focusClaimedElsewhere =
        active && active !== document.body && isWithinAnyOpenLayer(active)
      if (!focusClaimedElsewhere) {
        previouslyFocusedRef.current?.focus?.()
      }
    }
  }, [active, containerRef])
}

/**
 * Restores focus to whatever was focused immediately before `active` became
 * true, the instant `active` becomes false — independent of how much longer
 * the panel stays mounted afterward (e.g. an exit animation). Pairs with
 * Headless UI's `<FocusTrap>` (InitialFocus | TabLock only, no RestoreFocus
 * bit): FocusTrap's own restore-focus fires on unmount, which for Dialog/
 * AlertDialog/Sheet is ~150-200ms after `active` goes false because
 * `usePresence` keeps the panel mounted for its exit animation — too late to
 * match the previous hand-rolled focus-trap's immediate restore.
 */
function useRestorePreviousFocus(active: boolean) {
  const previouslyFocusedRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (active) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null
      return
    }
    const currentlyFocused = document.activeElement as HTMLElement | null
    const focusClaimedElsewhere =
      currentlyFocused &&
      currentlyFocused !== document.body &&
      isWithinAnyOpenLayer(currentlyFocused)
    if (!focusClaimedElsewhere) {
      previouslyFocusedRef.current?.focus?.()
    }
  }, [active])
}

let scrollLockCount = 0
let previousBodyOverflow: string | null = null

/**
 * Locks page scroll while any modal overlay is open, reference-counted so
 * nested dialogs don't unlock scrolling when the inner one closes while the
 * outer one is still open.
 */
function useScrollLock(active: boolean) {
  React.useEffect(() => {
    if (!active) return

    if (scrollLockCount === 0) {
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = "hidden"
    }
    scrollLockCount++

    return () => {
      scrollLockCount--
      if (scrollLockCount === 0) {
        document.body.style.overflow = previousBodyOverflow ?? ""
        previousBodyOverflow = null
      }
    }
  }, [active])
}

/**
 * Restores focus to `triggerRef` when `open` transitions from true to false —
 * unless focus has already been claimed by some other overlay that opened as
 * a side effect of this one closing (e.g. selecting a menu item that
 * immediately opens a confirmation dialog). Without that guard, this would
 * race with the new overlay's own focus-on-open and steal focus back.
 */
function useReturnFocusOnClose(
  triggerRef: React.RefObject<HTMLElement | null>,
  open: boolean
) {
  const wasOpenRef = React.useRef(open)

  React.useEffect(() => {
    if (wasOpenRef.current && !open) {
      const active = document.activeElement as HTMLElement | null
      const focusClaimedElsewhere =
        active && active !== document.body && isWithinAnyOpenLayer(active)
      if (!focusClaimedElsewhere) {
        triggerRef.current?.focus()
      }
    }
    wasOpenRef.current = open
  }, [open, triggerRef])
}

/** Minimal preventable-event shape matching what radix-ui's escape-hatch callbacks receive. */
type PreventableEvent = { defaultPrevented: boolean; preventDefault: () => void }

function createPreventableEvent(): PreventableEvent {
  return {
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true
    },
  }
}

export {
  useFocusTrap,
  useScrollLock,
  useReturnFocusOnClose,
  useRestorePreviousFocus,
  createPreventableEvent,
}
export type { PreventableEvent }
