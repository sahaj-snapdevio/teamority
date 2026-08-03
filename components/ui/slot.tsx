import * as React from "react"

import { cn } from "@/lib/utils"

function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return (value) => {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(value)
      } else if (ref && typeof ref === "object") {
        ;(ref as React.RefObject<T | null>).current = value
      }
    }
  }
}

type SlotProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode
  ref?: React.Ref<HTMLElement>
}

/**
 * Minimal `asChild` polyfill: clones the single child, merging className/style,
 * chaining matching event handlers instead of overwriting them, and merging
 * refs so both the wrapper's ref and the child's own ref keep working.
 * Replaces radix-ui's Slot for components that only used it for asChild
 * support (no other Radix behavior involved).
 */
function Slot({ children, ref, ...slotProps }: SlotProps) {
  if (!React.isValidElement(children)) {
    return children ?? null
  }

  const child = children as React.ReactElement<Record<string, unknown>>
  const childProps = child.props ?? {}
  const merged: Record<string, unknown> = { ...slotProps, ...childProps }

  merged.className = cn(
    slotProps.className as string | undefined,
    childProps.className as string | undefined
  )

  if (slotProps.style || childProps.style) {
    merged.style = {
      ...(slotProps.style as object | undefined),
      ...(childProps.style as object | undefined),
    }
  }

  for (const key of Object.keys(slotProps)) {
    const slotValue = (slotProps as Record<string, unknown>)[key]
    if (key.startsWith("on") && typeof slotValue === "function") {
      const childValue = childProps[key]
      const childHandler =
        typeof childValue === "function"
          ? (childValue as (...args: unknown[]) => void)
          : undefined
      merged[key] = (...args: unknown[]) => {
        ;(slotValue as (...args: unknown[]) => void)(...args)
        childHandler?.(...args)
      }
    }
  }

  const childRef = (childProps as { ref?: React.Ref<HTMLElement> }).ref
  merged.ref = ref || childRef ? mergeRefs(ref, childRef) : undefined

  return React.cloneElement(child, merged)
}

export { Slot }
